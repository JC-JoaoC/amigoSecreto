import "server-only";
import { drawInputSchema, idSchema } from "@/lib/validation";
import { avatarUrl } from "@/lib/avatar";
import { toSearchText } from "@/lib/text";
import { decrypt, encrypt, hmac } from "../crypto";
import { prisma, type Tx } from "../db";
import { AppError } from "../errors";
import { sendMail } from "../mail/mailer";
import { drawCompletedEmail } from "../mail/templates";
import { InvalidDrawError, type RandomInt, createAssignments } from "../draw/derangement";
import { parseOrThrow } from "../validate";

export type Actor = { id: string; role: "USER" | "ORGANIZER" };

function assertOrganizer(actor: Actor) {
  if (actor.role !== "ORGANIZER") {
    throw new AppError("FORBIDDEN", "Apenas organizadores podem fazer isso.");
  }
}

const notFound = () => new AppError("NOT_FOUND", "Sorteio não encontrado.");
const alreadyDone = () =>
  new AppError("DRAW_COMPLETED", "Este sorteio já foi realizado. Os participantes não podem mais mudar.");

/**
 * Trava a linha do sorteio (UPDATE condicional) enquanto ele está aberto.
 * Qualquer operação concorrente (inclusive o próprio sorteio) espera a transação terminar,
 * e depois reavalia o status. Assim ninguém entra/sai durante ou após o sorteio.
 */
async function lockOpenDraw(tx: Tx, drawId: string) {
  const locked = await tx.draw.updateMany({ where: { id: drawId, status: "OPEN" }, data: { updatedAt: new Date() } });
  if (locked.count === 0) {
    const exists = await tx.draw.findUnique({ where: { id: drawId }, select: { id: true } });
    throw exists ? alreadyDone() : notFound();
  }
}

// ───────────────────────────── Consultas ─────────────────────────────

export async function listDraws(actor: Actor) {
  const draws = await prisma.draw.findMany({
    where:
      actor.role === "ORGANIZER"
        ? {}
        : { OR: [{ status: "OPEN" }, { participants: { some: { userId: actor.id } } }] },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      description: true,
      budget: true,
      eventDate: true,
      status: true,
      completedAt: true,
      _count: { select: { participants: true } },
      participants: { where: { userId: actor.id }, select: { id: true } },
    },
  });
  return draws.map(({ _count, participants, ...d }) => ({
    ...d,
    participantCount: _count.participants,
    isParticipant: participants.length > 0,
  }));
}

export async function getDraw(actor: Actor, drawId: unknown) {
  const id = parseOrThrow(idSchema, drawId);
  const draw = await prisma.draw.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      budget: true,
      eventDate: true,
      status: true,
      createdAt: true,
      completedAt: true,
      createdBy: { select: { name: true } },
      participants: {
        orderBy: { user: { searchName: "asc" } },
        select: { userId: true, user: { select: { name: true, avatarUpdatedAt: true } } },
      },
    },
  });
  if (!draw) throw notFound();

  const isParticipant = draw.participants.some((p) => p.userId === actor.id);
  const isOrg = actor.role === "ORGANIZER";
  // Quem não organiza só enxerga sorteios abertos (para entrar) ou dos quais participa.
  if (!isOrg && !isParticipant && draw.status !== "OPEN") throw notFound();

  const revealedCount =
    isOrg && draw.status === "COMPLETED"
      ? await prisma.drawResult.count({ where: { drawId: id, revealedAt: { not: null } } })
      : null;

  return {
    ...draw,
    createdByName: draw.createdBy?.name ?? null,
    participants: draw.participants.map((p) => ({
      userId: p.userId,
      name: p.user.name,
      avatarUrl: avatarUrl(p.userId, p.user.avatarUpdatedAt),
    })),
    isParticipant,
    canManage: isOrg,
    revealedCount,
  };
}

/** Pessoas cadastradas que ainda não estão no sorteio (para o organizador adicionar). */
export async function listAddableUsers(actor: Actor, drawId: unknown, q?: string) {
  assertOrganizer(actor);
  const id = parseOrThrow(idSchema, drawId);
  const search = toSearchText(q ?? "").slice(0, 80);
  const users = await prisma.user.findMany({
    where: {
      participations: { none: { drawId: id } },
      ...(search ? { searchName: { contains: search } } : {}),
    },
    orderBy: { searchName: "asc" },
    take: 50,
    select: { id: true, name: true, avatarUpdatedAt: true },
  });
  return users.map((u) => ({ id: u.id, name: u.name, avatarUrl: avatarUrl(u.id, u.avatarUpdatedAt) }));
}

// ───────────────────────────── Organização ─────────────────────────────

export async function createDraw(actor: Actor, input: unknown) {
  assertOrganizer(actor);
  const data = parseOrThrow(drawInputSchema, input);
  return prisma.draw.create({ data: { ...data, createdById: actor.id }, select: { id: true } });
}

export async function updateDraw(actor: Actor, drawId: unknown, input: unknown) {
  assertOrganizer(actor);
  const id = parseOrThrow(idSchema, drawId);
  const data = parseOrThrow(drawInputSchema, input);
  const updated = await prisma.draw.updateMany({ where: { id, status: "OPEN" }, data });
  if (updated.count === 0) {
    const exists = await prisma.draw.findUnique({ where: { id }, select: { id: true } });
    throw exists ? alreadyDone() : notFound();
  }
}

/** Exclui o sorteio (e seus resultados). Útil depois da troca de presentes. */
export async function deleteDraw(actor: Actor, drawId: unknown) {
  assertOrganizer(actor);
  const id = parseOrThrow(idSchema, drawId);
  await prisma.$transaction(async (tx) => {
    // Resultados primeiro (apontam para participantes); depois o sorteio leva o resto em cascata.
    await tx.drawResult.deleteMany({ where: { drawId: id } });
    const deleted = await tx.draw.deleteMany({ where: { id } });
    if (deleted.count === 0) throw notFound();
  });
}

export async function addParticipants(actor: Actor, drawId: unknown, userIds: unknown) {
  assertOrganizer(actor);
  const id = parseOrThrow(idSchema, drawId);
  const ids = Array.isArray(userIds) ? [...new Set(userIds.map((u) => parseOrThrow(idSchema, u)))] : [];
  if (ids.length === 0) throw new AppError("VALIDATION", "Selecione pelo menos uma pessoa.");
  if (ids.length > 500) throw new AppError("VALIDATION", "Selecione no máximo 500 pessoas por vez.");

  return prisma.$transaction(async (tx) => {
    await lockOpenDraw(tx, id);
    const valid = await tx.user.findMany({ where: { id: { in: ids } }, select: { id: true } });
    const created = await tx.drawParticipant.createMany({
      data: valid.map((u) => ({ drawId: id, userId: u.id })),
      skipDuplicates: true,
    });
    return { added: created.count };
  });
}

export async function removeParticipant(actor: Actor, drawId: unknown, userId: unknown) {
  assertOrganizer(actor);
  const id = parseOrThrow(idSchema, drawId);
  const uid = parseOrThrow(idSchema, userId);
  await prisma.$transaction(async (tx) => {
    await lockOpenDraw(tx, id);
    await tx.drawParticipant.deleteMany({ where: { drawId: id, userId: uid } });
  });
}

// ───────────────────────────── Participação ─────────────────────────────

export async function joinDraw(actor: Actor, drawId: unknown) {
  const id = parseOrThrow(idSchema, drawId);
  await prisma.$transaction(async (tx) => {
    await lockOpenDraw(tx, id);
    await tx.drawParticipant.createMany({ data: [{ drawId: id, userId: actor.id }], skipDuplicates: true });
  });
}

export async function leaveDraw(actor: Actor, drawId: unknown) {
  const id = parseOrThrow(idSchema, drawId);
  await prisma.$transaction(async (tx) => {
    await lockOpenDraw(tx, id);
    await tx.drawParticipant.deleteMany({ where: { drawId: id, userId: actor.id } });
  });
}

// ───────────────────────────── Sorteio ─────────────────────────────

export type RunDrawOptions = {
  /** Fonte de aleatoriedade (padrão: crypto.randomInt). Só testes sobrescrevem. */
  random?: RandomInt;
  /** Gancho de teste: executado antes do COMMIT (permite simular falhas no meio da gravação). */
  beforeCommit?: (tx: Tx) => Promise<void>;
};

/**
 * Executa o sorteio inteiramente no servidor, numa única transação:
 *  1. muda OPEN -> COMPLETED com UPDATE condicional (trava a linha; tentativas simultâneas esperam
 *     e depois falham com "já realizado");
 *  2. lê os participantes já com a trava ativa (ninguém entra/sai no meio);
 *  3. gera as atribuições (Fisher-Yates + crypto, sem autoindicação) e valida;
 *  4. grava 1 resultado por participante, com o destinatário cifrado.
 * Qualquer erro desfaz tudo, e o banco recusa COMMIT de sorteio incompleto (trigger).
 */
export async function runDraw(actor: Actor, drawId: unknown, options: RunDrawOptions = {}) {
  assertOrganizer(actor);
  const id = parseOrThrow(idSchema, drawId);

  const outcome = await prisma.$transaction(
    async (tx) => {
      const now = new Date();
      const locked = await tx.draw.updateMany({
        where: { id, status: "OPEN" },
        data: { status: "COMPLETED", completedAt: now },
      });
      if (locked.count === 0) {
        const exists = await tx.draw.findUnique({ where: { id }, select: { id: true } });
        throw exists ? new AppError("DRAW_COMPLETED", "Este sorteio já foi realizado.") : notFound();
      }

      const participants = await tx.drawParticipant.findMany({
        where: { drawId: id },
        select: { id: true, userId: true, user: { select: { name: true, email: true } } },
      });
      if (participants.length < 2) {
        throw new AppError("DRAW_NOT_ENOUGH", "São necessários pelo menos 2 participantes para realizar o sorteio.");
      }

      let assignments;
      try {
        assignments = createAssignments(
          participants.map((p) => p.userId),
          options.random,
        );
      } catch (error) {
        if (error instanceof InvalidDrawError) throw new AppError("DRAW_NOT_ENOUGH", error.message);
        throw error;
      }

      const participantByUser = new Map(participants.map((p) => [p.userId, p]));
      await tx.drawResult.createMany({
        data: assignments.map(({ giver, receiver }) => {
          const participant = participantByUser.get(giver)!;
          return {
            drawId: id,
            participantId: participant.id,
            receiverCipher: encrypt(receiver, `${id}:${participant.id}`),
            receiverHash: hmac("draw-receiver-hash", `${id}:${receiver}`),
          };
        }),
      });

      await options.beforeCommit?.(tx);

      const draw = await tx.draw.findUniqueOrThrow({ where: { id }, select: { name: true } });
      return {
        drawName: draw.name,
        recipients: participants.map((p) => ({ name: p.user.name, email: p.user.email })),
      };
    },
    { maxWait: 10_000, timeout: 30_000 },
  );

  return { drawId: id, participantCount: outcome.recipients.length, ...outcome };
}

/** Avisa os participantes por e-mail (sem revelar nomes). Falhas não desfazem o sorteio. */
export async function notifyDrawCompleted(params: {
  drawId: string;
  drawName: string;
  recipients: { name: string; email: string }[];
}) {
  let failed = 0;
  for (const r of params.recipients) {
    try {
      await sendMail(drawCompletedEmail({ to: r.email, name: r.name, drawName: params.drawName, drawId: params.drawId }));
    } catch {
      failed++;
    }
  }
  if (failed > 0) console.warn(`[draws] ${failed} aviso(s) de sorteio não enviados (sorteio ${params.drawId}).`);
}

// ───────────────────────────── Resultado individual ─────────────────────────────

/** Sorteios de que a pessoa participa, sem nenhum dado de resultado. */
export async function listMyParticipations(actor: Actor) {
  const rows = await prisma.drawParticipant.findMany({
    where: { userId: actor.id },
    orderBy: { createdAt: "desc" },
    select: {
      draw: {
        select: { id: true, name: true, status: true, budget: true, eventDate: true, completedAt: true },
      },
      result: { select: { revealedAt: true } },
    },
  });
  return rows.map((r) => ({ ...r.draw, revealed: Boolean(r.result?.revealedAt) }));
}

/**
 * Único ponto do sistema que revela um destinatário, e só o do próprio usuário autenticado.
 * A busca parte de (drawId, actor.id): não existe parâmetro que permita pedir o resultado de outra pessoa.
 */
export async function getMyResult(actor: Actor, drawId: unknown) {
  const id = parseOrThrow(idSchema, drawId);
  const participant = await prisma.drawParticipant.findUnique({
    where: { drawId_userId: { drawId: id, userId: actor.id } },
    select: {
      id: true,
      draw: { select: { id: true, name: true, status: true, budget: true, eventDate: true } },
      result: { select: { receiverCipher: true, revealedAt: true } },
    },
  });
  if (!participant) throw new AppError("NOT_FOUND", "Você não participa deste sorteio.");
  if (participant.draw.status !== "COMPLETED" || !participant.result) {
    throw new AppError("DRAW_NOT_READY", "O sorteio ainda não foi realizado. Aguarde o organizador.");
  }

  const receiverId = decrypt(participant.result.receiverCipher, `${id}:${participant.id}`);
  const receiver = await prisma.user.findUnique({
    where: { id: receiverId },
    select: { id: true, name: true, _count: { select: { gifts: true } } },
  });
  if (!receiver) throw new AppError("NOT_FOUND", "Não encontramos a pessoa sorteada. Fale com o organizador.");

  if (!participant.result.revealedAt) {
    await prisma.drawResult.update({ where: { participantId: participant.id }, data: { revealedAt: new Date() } });
  }

  return {
    draw: participant.draw,
    receiver: { id: receiver.id, name: receiver.name, giftCount: receiver._count.gifts },
  };
}
