import "server-only";
import { avatarUrl } from "@/lib/avatar";
import { toSearchText } from "@/lib/text";
import { bagDrawInputSchema, idSchema } from "@/lib/validation";
import { prisma, type Tx } from "../db";
import type { RandomInt } from "../draw/derangement";
import { pickNextFromBag } from "../draw/bag";
import { AppError } from "../errors";
import { parseOrThrow } from "../validate";
import type { Actor } from "./draws";

/**
 * Sorteio do saco: o organizador coloca pessoas cadastradas no saco e tira um nome por vez.
 * Quem sobra por último ganha. Opcionalmente, o organizador marca quem fica por último
 * (`lastUserId`); esse dado só sai do servidor para organizadores.
 */

function assertOrganizer(actor: Actor) {
  if (actor.role !== "ORGANIZER") {
    throw new AppError("FORBIDDEN", "Apenas organizadores podem fazer isso.");
  }
}

const notFound = () => new AppError("NOT_FOUND", "Sorteio não encontrado.");
const alreadyStarted = () =>
  new AppError("DRAW_COMPLETED", "Este sorteio já começou. Ninguém entra nem sai do saco.");

/** Trava a linha do sorteio enquanto ele está aberto (mesma estratégia do amigo secreto). */
async function lockOpenBag(tx: Tx, bagId: string) {
  const locked = await tx.bagDraw.updateMany({ where: { id: bagId, status: "OPEN" }, data: { updatedAt: new Date() } });
  if (locked.count === 0) {
    const exists = await tx.bagDraw.findUnique({ where: { id: bagId }, select: { id: true } });
    throw exists ? alreadyStarted() : notFound();
  }
}

// ───────────────────────────── Consultas ─────────────────────────────

export async function listBagDraws(actor: Actor) {
  const isOrg = actor.role === "ORGANIZER";
  const bags = await prisma.bagDraw.findMany({
    where: isOrg ? {} : { entries: { some: { userId: actor.id } } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      createdAt: true,
      completedAt: true,
      _count: { select: { entries: true } },
      // Maior posição: no sorteio concluído, é quem ficou por último.
      entries: {
        where: { position: { not: null } },
        orderBy: { position: "desc" },
        take: 1,
        select: { user: { select: { name: true } } },
      },
    },
  });

  const mine = isOrg
    ? new Set(
        (
          await prisma.bagEntry.findMany({
            where: { userId: actor.id, bagDrawId: { in: bags.map((b) => b.id) } },
            select: { bagDrawId: true },
          })
        ).map((e) => e.bagDrawId),
      )
    : null;

  return bags.map(({ _count, entries, ...b }) => ({
    ...b,
    entryCount: _count.entries,
    winnerName: b.status === "COMPLETED" ? (entries[0]?.user.name ?? null) : null,
    isParticipant: mine ? mine.has(b.id) : true,
  }));
}

export type BagPerson = { userId: string; name: string; avatarUrl: string | null };
export type DrawnPerson = BagPerson & { position: number };

export async function getBagDraw(actor: Actor, bagId: unknown) {
  const id = parseOrThrow(idSchema, bagId);
  const bag = await prisma.bagDraw.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      lastUserId: true,
      createdAt: true,
      startedAt: true,
      completedAt: true,
      createdBy: { select: { name: true } },
      entries: {
        select: { userId: true, position: true, user: { select: { name: true, searchName: true, avatarUpdatedAt: true } } },
      },
    },
  });
  if (!bag) throw notFound();

  const isOrg = actor.role === "ORGANIZER";
  const isParticipant = bag.entries.some((e) => e.userId === actor.id);
  // Quem não organiza só enxerga os sorteios em que está no saco.
  if (!isOrg && !isParticipant) throw notFound();

  const toPerson = (e: (typeof bag.entries)[number]): BagPerson => ({
    userId: e.userId,
    name: e.user.name,
    avatarUrl: avatarUrl(e.userId, e.user.avatarUpdatedAt),
  });

  const inBag = bag.entries
    .filter((e) => e.position === null)
    .sort((a, b) => a.user.searchName.localeCompare(b.user.searchName))
    .map(toPerson);
  const drawn: DrawnPerson[] = bag.entries
    .filter((e) => e.position !== null)
    .sort((a, b) => a.position! - b.position!)
    .map((e) => ({ ...toPerson(e), position: e.position! }));

  // No sorteio concluído, a última posição é de quem sobrou no saco.
  const winner = bag.status === "COMPLETED" ? (drawn.at(-1) ?? null) : null;

  return {
    id: bag.id,
    name: bag.name,
    description: bag.description,
    status: bag.status,
    createdAt: bag.createdAt,
    startedAt: bag.startedAt,
    completedAt: bag.completedAt,
    createdByName: bag.createdBy?.name ?? null,
    total: bag.entries.length,
    inBag,
    drawn: winner ? drawn.slice(0, -1) : drawn,
    winner,
    isParticipant,
    canManage: isOrg,
    /** Só para organizadores; nulo para os demais. */
    lastUserId: isOrg ? bag.lastUserId : null,
  };
}

/** Pessoas cadastradas que ainda não estão no saco. */
export async function listAddableBagUsers(actor: Actor, bagId: unknown, q?: string) {
  assertOrganizer(actor);
  const id = parseOrThrow(idSchema, bagId);
  const search = toSearchText(q ?? "").slice(0, 80);
  const users = await prisma.user.findMany({
    where: {
      bagEntries: { none: { bagDrawId: id } },
      ...(search ? { searchName: { contains: search } } : {}),
    },
    orderBy: { searchName: "asc" },
    take: 50,
    select: { id: true, name: true, avatarUpdatedAt: true },
  });
  return users.map((u) => ({ id: u.id, name: u.name, avatarUrl: avatarUrl(u.id, u.avatarUpdatedAt) }));
}

// ───────────────────────────── Organização ─────────────────────────────

export async function createBagDraw(actor: Actor, input: unknown) {
  assertOrganizer(actor);
  const data = parseOrThrow(bagDrawInputSchema, input);
  return prisma.bagDraw.create({ data: { ...data, createdById: actor.id }, select: { id: true } });
}

/** Nome e recado podem mudar a qualquer momento (não afetam o resultado). */
export async function updateBagDraw(actor: Actor, bagId: unknown, input: unknown) {
  assertOrganizer(actor);
  const id = parseOrThrow(idSchema, bagId);
  const data = parseOrThrow(bagDrawInputSchema, input);
  const updated = await prisma.bagDraw.updateMany({ where: { id }, data });
  if (updated.count === 0) throw notFound();
}

export async function deleteBagDraw(actor: Actor, bagId: unknown) {
  assertOrganizer(actor);
  const id = parseOrThrow(idSchema, bagId);
  const deleted = await prisma.bagDraw.deleteMany({ where: { id } });
  if (deleted.count === 0) throw notFound();
}

export async function addBagEntries(actor: Actor, bagId: unknown, userIds: unknown) {
  assertOrganizer(actor);
  const id = parseOrThrow(idSchema, bagId);
  const ids = Array.isArray(userIds) ? [...new Set(userIds.map((u) => parseOrThrow(idSchema, u)))] : [];
  if (ids.length === 0) throw new AppError("VALIDATION", "Selecione pelo menos uma pessoa.");
  if (ids.length > 500) throw new AppError("VALIDATION", "Selecione no máximo 500 pessoas por vez.");

  return prisma.$transaction(async (tx) => {
    await lockOpenBag(tx, id);
    const valid = await tx.user.findMany({ where: { id: { in: ids } }, select: { id: true } });
    const created = await tx.bagEntry.createMany({
      data: valid.map((u) => ({ bagDrawId: id, userId: u.id })),
      skipDuplicates: true,
    });
    return { added: created.count };
  });
}

export async function removeBagEntry(actor: Actor, bagId: unknown, userId: unknown) {
  assertOrganizer(actor);
  const id = parseOrThrow(idSchema, bagId);
  const uid = parseOrThrow(idSchema, userId);
  await prisma.$transaction(async (tx) => {
    await lockOpenBag(tx, id);
    await tx.bagEntry.deleteMany({ where: { bagDrawId: id, userId: uid } });
    // Quem saiu do saco não pode continuar marcado para ficar por último.
    await tx.bagDraw.updateMany({ where: { id, lastUserId: uid }, data: { lastUserId: null } });
  });
}

/** Define quem fica por último no saco (ou `null` para deixar aleatório). Só antes de começar. */
export async function setBagLast(actor: Actor, bagId: unknown, userId: unknown) {
  assertOrganizer(actor);
  const id = parseOrThrow(idSchema, bagId);
  const uid = userId === null || userId === undefined || userId === "" ? null : parseOrThrow(idSchema, userId);
  await prisma.$transaction(async (tx) => {
    await lockOpenBag(tx, id);
    if (uid) {
      const inBag = await tx.bagEntry.findUnique({ where: { bagDrawId_userId: { bagDrawId: id, userId: uid } }, select: { id: true } });
      if (!inBag) throw new AppError("VALIDATION", "Essa pessoa não está no saco.");
    }
    await tx.bagDraw.update({ where: { id }, data: { lastUserId: uid } });
  });
}

// ───────────────────────────── Tirar nomes ─────────────────────────────

export type DrawNextOptions = {
  /** Fonte de aleatoriedade (padrão: crypto.randomInt). Só testes sobrescrevem. */
  random?: RandomInt;
};

/**
 * Tira o próximo nome do saco, numa transação:
 *  1. trava a linha do sorteio (cliques simultâneos esperam e depois reavaliam);
 *  2. sorteia entre quem ainda está no saco, nunca quem foi marcado para ficar por último;
 *  3. grava a posição de saída;
 *  4. se sobrar 1 nome, ele recebe a última posição e o sorteio termina.
 */
export async function drawNextFromBag(actor: Actor, bagId: unknown, options: DrawNextOptions = {}) {
  assertOrganizer(actor);
  const id = parseOrThrow(idSchema, bagId);

  return prisma.$transaction(
    async (tx) => {
      const now = new Date();
      const locked = await tx.bagDraw.updateMany({
        where: { id, status: { in: ["OPEN", "RUNNING"] } },
        data: { updatedAt: now },
      });
      if (locked.count === 0) {
        const exists = await tx.bagDraw.findUnique({ where: { id }, select: { id: true } });
        throw exists ? new AppError("DRAW_COMPLETED", "Este sorteio já terminou.") : notFound();
      }

      const bag = await tx.bagDraw.findUniqueOrThrow({ where: { id }, select: { status: true, lastUserId: true } });
      const entries = await tx.bagEntry.findMany({
        where: { bagDrawId: id },
        select: { id: true, userId: true, position: true, user: { select: { name: true } } },
      });
      if (bag.status === "OPEN" && entries.length < 2) {
        throw new AppError("DRAW_NOT_ENOUGH", "Coloque pelo menos 2 pessoas no saco.");
      }

      const remaining = entries.filter((e) => e.position === null);
      let nextPosition = entries.length - remaining.length + 1;

      let drawn: { userId: string; name: string; position: number } | null = null;
      let left = remaining;
      // Normalmente há ≥ 2 no saco aqui. Com 1 (alguém excluiu a conta no meio), só falta encerrar.
      if (remaining.length >= 2) {
        const nextUserId = pickNextFromBag(
          remaining.map((e) => e.userId),
          bag.lastUserId,
          options.random,
        );
        const picked = remaining.find((e) => e.userId === nextUserId)!;
        await tx.bagEntry.update({ where: { id: picked.id }, data: { position: nextPosition, drawnAt: now } });
        drawn = { userId: picked.userId, name: picked.user.name, position: nextPosition };
        nextPosition++;
        left = remaining.filter((e) => e.id !== picked.id);
      }

      let winner: { userId: string; name: string } | null = null;
      if (left.length === 1) {
        const last = left[0];
        await tx.bagEntry.update({ where: { id: last.id }, data: { position: nextPosition, drawnAt: now } });
        winner = { userId: last.userId, name: last.user.name };
      }

      const finished = left.length <= 1;
      await tx.bagDraw.update({
        where: { id },
        data: {
          status: finished ? "COMPLETED" : "RUNNING",
          ...(bag.status === "OPEN" ? { startedAt: now } : {}),
          ...(finished ? { completedAt: now } : {}),
        },
      });

      return { drawn, winner, remaining: finished ? 0 : left.length };
    },
    { maxWait: 10_000, timeout: 30_000 },
  );
}
