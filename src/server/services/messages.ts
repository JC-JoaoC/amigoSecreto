import "server-only";
import { z } from "zod";
import { idSchema } from "@/lib/validation";
import { decrypt, encrypt, hmac } from "../crypto";
import { prisma } from "../db";
import { AppError } from "../errors";
import { enforceRateLimit, rateLimitKey } from "../rate-limit";
import { parseOrThrow } from "../validate";
import type { Actor } from "./draws";

/**
 * Mensagens anônimas entre o par do sorteio.
 *
 * Cada pessoa tem até duas conversas por sorteio:
 *  - "receiver": com quem ela tirou (ela é o amigo secreto, fica anônima);
 *  - "secret-friend": com quem a tirou (o amigo secreto dela, que fica anônimo).
 *
 * A conversa pertence ao resultado de quem presenteia. A conversa "secret-friend" é
 * encontrada pelo HMAC do destinatário — o servidor nunca precisa (nem devolve) a identidade
 * de quem presenteia. As mensagens não guardam id de usuário: o autor sai da direção.
 */

export const MESSAGE_MAX_LENGTH = 1000;
const MESSAGES_PER_THREAD_LIMIT = 500;
const SEND_RATE = { limit: 60, windowSeconds: 60 * 60 };

export type ConversationSide = "receiver" | "secret-friend";

export const messageBodySchema = z
  .string({ error: "Escreva uma mensagem." })
  .trim()
  .min(1, { error: "Escreva uma mensagem." })
  .max(MESSAGE_MAX_LENGTH, { error: `Use no máximo ${MESSAGE_MAX_LENGTH} caracteres.` });

const sideSchema = z.enum(["receiver", "secret-friend"]);

const aadFor = (resultId: string) => `msg:${resultId}`;

/** Conversa em que o usuário é quem presenteia (o resultado dele). */
async function threadAsGiver(actor: Actor, drawId: string) {
  return prisma.drawResult.findFirst({
    where: { drawId, participant: { userId: actor.id }, draw: { status: "COMPLETED" } },
    select: { id: true },
  });
}

/** Conversa em que o usuário é o sorteado: localizada pelo HMAC do destinatário. */
async function threadAsReceiver(actor: Actor, drawId: string) {
  return prisma.drawResult.findFirst({
    where: {
      drawId,
      receiverHash: hmac("draw-receiver-hash", `${drawId}:${actor.id}`),
      draw: { status: "COMPLETED" },
    },
    select: { id: true },
  });
}

function threadFor(actor: Actor, drawId: string, side: ConversationSide) {
  return side === "receiver" ? threadAsGiver(actor, drawId) : threadAsReceiver(actor, drawId);
}

// Direção das mensagens que EU escrevo em cada lado da conversa.
const outgoing = { receiver: "TO_RECEIVER", "secret-friend": "TO_GIVER" } as const;
const incoming = { receiver: "TO_GIVER", "secret-friend": "TO_RECEIVER" } as const;

export type ConversationMessage = { id: string; mine: boolean; body: string; createdAt: Date };
export type Conversation = { messages: ConversationMessage[]; unread: number };

async function loadThread(resultId: string, side: ConversationSide): Promise<Conversation> {
  const rows = await prisma.drawMessage.findMany({
    where: { resultId },
    orderBy: { createdAt: "asc" },
    select: { id: true, direction: true, bodyCipher: true, readAt: true, createdAt: true },
  });
  const messages = rows.map((m) => ({
    id: m.id,
    mine: m.direction === outgoing[side],
    body: decrypt(m.bodyCipher, aadFor(resultId), "draw-message-cipher"),
    createdAt: m.createdAt,
  }));
  const unread = rows.filter((m) => m.direction === incoming[side] && !m.readAt).length;
  return { messages, unread };
}

/** As duas conversas do usuário num sorteio realizado. */
export async function getConversations(actor: Actor, drawId: unknown) {
  const id = parseOrThrow(idSchema, drawId);
  const [asGiver, asReceiver] = await Promise.all([threadAsGiver(actor, id), threadAsReceiver(actor, id)]);
  if (!asGiver && !asReceiver) {
    throw new AppError("NOT_FOUND", "As mensagens ficam disponíveis depois do sorteio, só para quem participa.");
  }
  const [withReceiver, withSecretFriend] = await Promise.all([
    asGiver ? loadThread(asGiver.id, "receiver") : null,
    asReceiver ? loadThread(asReceiver.id, "secret-friend") : null,
  ]);
  return { withReceiver, withSecretFriend };
}

export async function sendMessage(actor: Actor, drawId: unknown, side: unknown, body: unknown) {
  const id = parseOrThrow(idSchema, drawId);
  const to = parseOrThrow(sideSchema, side);
  const text = parseOrThrow(messageBodySchema, body);
  await enforceRateLimit(rateLimitKey("msg:user", actor.id), SEND_RATE);

  const thread = await threadFor(actor, id, to);
  if (!thread) {
    throw new AppError("NOT_FOUND", "Esta conversa não está disponível. O sorteio precisa ter sido realizado.");
  }
  const total = await prisma.drawMessage.count({ where: { resultId: thread.id } });
  if (total >= MESSAGES_PER_THREAD_LIMIT) {
    throw new AppError("LIMIT_REACHED", "Esta conversa chegou ao limite de mensagens.");
  }

  const message = await prisma.drawMessage.create({
    data: {
      resultId: thread.id,
      direction: outgoing[to],
      bodyCipher: encrypt(text, aadFor(thread.id), "draw-message-cipher"),
    },
    select: { id: true, createdAt: true },
  });
  return { id: message.id, createdAt: message.createdAt, body: text };
}

/** Marca como lidas as mensagens recebidas numa conversa. */
export async function markConversationRead(actor: Actor, drawId: unknown, side: unknown) {
  const id = parseOrThrow(idSchema, drawId);
  const which = parseOrThrow(sideSchema, side);
  const thread = await threadFor(actor, id, which);
  if (!thread) return { updated: 0 };
  const r = await prisma.drawMessage.updateMany({
    where: { resultId: thread.id, direction: incoming[which], readAt: null },
    data: { readAt: new Date() },
  });
  return { updated: r.count };
}

/** Total de mensagens não lidas do usuário (para o contador do menu). */
export async function countUnreadMessages(actor: Actor): Promise<number> {
  const parts = await prisma.drawParticipant.findMany({
    where: { userId: actor.id, draw: { status: "COMPLETED" } },
    select: { drawId: true, result: { select: { id: true } } },
  });
  if (parts.length === 0) return 0;
  const myResults = parts.flatMap((p) => (p.result ? [p.result.id] : []));
  const asReceiver = parts.map((p) => ({ drawId: p.drawId, receiverHash: hmac("draw-receiver-hash", `${p.drawId}:${actor.id}`) }));
  return prisma.drawMessage.count({
    where: {
      readAt: null,
      OR: [
        { direction: "TO_GIVER", resultId: { in: myResults } },
        { direction: "TO_RECEIVER", result: { OR: asReceiver } },
      ],
    },
  });
}
