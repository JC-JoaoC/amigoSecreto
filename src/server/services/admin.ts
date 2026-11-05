import "server-only";
import { idSchema } from "@/lib/validation";
import { avatarUrl } from "@/lib/avatar";
import { decrypt } from "../crypto";
import { prisma } from "../db";
import { AppError } from "../errors";
import { parseOrThrow } from "../validate";
import type { Actor } from "./draws";

/**
 * Área do administrador: quem tirou quem e as mensagens de cada par.
 * É a única exceção ao sigilo do sorteio e só existe para ORGANIZER
 * (e-mail confirmado + presente em ORGANIZER_EMAILS). Cada consulta fica registrada no log.
 */

type Person = { id: string; name: string; avatarUrl: string | null };

export type AuditMessage = {
  id: string;
  /** "giver" = escrita pelo amigo secreto; "receiver" = resposta de quem foi sorteado. */
  from: "giver" | "receiver";
  body: string | null;
  createdAt: Date;
  readAt: Date | null;
};

export type AuditPair = {
  resultId: string;
  giver: Person;
  /** null quando não foi possível decifrar (APP_SECRET trocada) ou a conta não existe mais. */
  receiver: Person | null;
  revealedAt: Date | null;
  messages: AuditMessage[];
};

const UNREADABLE = null;

export async function getDrawAudit(actor: Actor, drawId: unknown) {
  if (actor.role !== "ORGANIZER") throw new AppError("FORBIDDEN", "Apenas organizadores podem fazer isso.");
  const id = parseOrThrow(idSchema, drawId);

  const draw = await prisma.draw.findUnique({
    where: { id },
    select: { id: true, name: true, status: true, completedAt: true, budget: true, eventDate: true },
  });
  if (!draw) throw new AppError("NOT_FOUND", "Sorteio não encontrado.");

  const isParticipant = Boolean(
    await prisma.drawParticipant.findUnique({ where: { drawId_userId: { drawId: id, userId: actor.id } }, select: { id: true } }),
  );

  if (draw.status !== "COMPLETED") return { draw, isParticipant, pairs: [] as AuditPair[] };

  const results = await prisma.drawResult.findMany({
    where: { drawId: id },
    select: {
      id: true,
      participantId: true,
      receiverCipher: true,
      revealedAt: true,
      participant: { select: { user: { select: { id: true, name: true, avatarUpdatedAt: true } } } },
      messages: {
        orderBy: { createdAt: "asc" },
        select: { id: true, direction: true, bodyCipher: true, readAt: true, createdAt: true },
      },
    },
  });

  const receiverIdOf = new Map<string, string | null>();
  for (const r of results) {
    try {
      receiverIdOf.set(r.id, decrypt(r.receiverCipher, `${id}:${r.participantId}`));
    } catch {
      receiverIdOf.set(r.id, UNREADABLE);
    }
  }

  const receiverIds = [...new Set([...receiverIdOf.values()].filter((v): v is string => Boolean(v)))];
  const receivers = await prisma.user.findMany({
    where: { id: { in: receiverIds } },
    select: { id: true, name: true, avatarUpdatedAt: true },
  });
  const receiverById = new Map(receivers.map((u) => [u.id, u]));

  const toPerson = (u: { id: string; name: string; avatarUpdatedAt: Date | null }): Person => ({
    id: u.id,
    name: u.name,
    avatarUrl: avatarUrl(u.id, u.avatarUpdatedAt),
  });

  const pairs: AuditPair[] = results
    .map((r) => {
      const receiverId = receiverIdOf.get(r.id);
      const receiver = receiverId ? receiverById.get(receiverId) : undefined;
      return {
        resultId: r.id,
        giver: toPerson(r.participant.user),
        receiver: receiver ? toPerson(receiver) : null,
        revealedAt: r.revealedAt,
        messages: r.messages.map((m) => {
          let body: string | null;
          try {
            body = decrypt(m.bodyCipher, `msg:${r.id}`, "draw-message-cipher");
          } catch {
            body = UNREADABLE;
          }
          return {
            id: m.id,
            from: m.direction === "TO_RECEIVER" ? ("giver" as const) : ("receiver" as const),
            body,
            createdAt: m.createdAt,
            readAt: m.readAt,
          };
        }),
      };
    })
    .sort((a, b) => a.giver.name.localeCompare(b.giver.name, "pt-BR"));

  console.info(`[admin] organizador ${actor.id} consultou os pares do sorteio ${id}`);
  return { draw, isParticipant, pairs };
}
