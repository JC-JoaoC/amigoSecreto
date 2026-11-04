import "server-only";
import { nameSchema } from "@/lib/validation";
import { toSearchText } from "@/lib/text";
import { prisma } from "../db";
import { AppError } from "../errors";
import { parseOrThrow } from "../validate";

export const PARTICIPANTS_PAGE_SIZE = 60;

/** Números reais exibidos na home. */
export async function getHomeStats() {
  const [participants, listsWithGifts, nextDraw] = await Promise.all([
    prisma.user.count({ where: { emailVerifiedAt: { not: null } } }),
    prisma.user.count({ where: { emailVerifiedAt: { not: null }, gifts: { some: {} } } }),
    prisma.draw.findFirst({
      where: { status: "OPEN", eventDate: { gte: new Date(new Date().toISOString().slice(0, 10)) } },
      orderBy: { eventDate: "asc" },
      select: { name: true, eventDate: true },
    }),
  ]);
  return { participants, listsWithGifts, nextDraw };
}

/** Primeiros nomes aleatórios para os papeizinhos do hero (mudam a cada visita). */
export async function sampleFirstNames(limit = 7): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ name: string }[]>`
    SELECT "name" FROM "users" WHERE "email_verified_at" IS NOT NULL ORDER BY random() LIMIT ${limit}
  `;
  return rows.map((r) => r.name.split(" ")[0] ?? r.name);
}

/** Só contas verificadas aparecem publicamente. E-mail NUNCA é retornado em listagens públicas. */
const publicWhere = { emailVerifiedAt: { not: null } } as const;

export async function listParticipants(params: { q?: string; page?: number; pageSize?: number }) {
  const pageSize = Math.min(Math.max(params.pageSize ?? PARTICIPANTS_PAGE_SIZE, 1), 100);
  const search = toSearchText(params.q ?? "").slice(0, 80);
  const where = {
    ...publicWhere,
    ...(search ? { searchName: { contains: search } } : {}),
  };

  const total = await prisma.user.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(Math.floor(params.page ?? 1), 1), pageCount);

  const items = await prisma.user.findMany({
    where,
    orderBy: [{ searchName: "asc" }, { id: "asc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: { id: true, name: true, _count: { select: { gifts: true } } },
  });

  return {
    items: items.map((u) => ({ id: u.id, name: u.name, giftCount: u._count.gifts })),
    total,
    page,
    pageCount,
    query: params.q?.trim() ?? "",
  };
}

export async function getParticipantWithGifts(userId: string) {
  return prisma.user.findFirst({
    where: { id: userId, ...publicWhere },
    select: {
      id: true,
      name: true,
      gifts: {
        orderBy: { createdAt: "asc" },
        select: { id: true, title: true, url: true, description: true },
      },
    },
  });
}

export async function getAccount(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      _count: { select: { gifts: true, participations: true } },
    },
  });
  if (!user) throw new AppError("NOT_FOUND", "Conta não encontrada.");
  return user;
}

export async function updateMyName(userId: string, rawName: unknown) {
  const name = parseOrThrow(nameSchema, rawName);
  await prisma.user.update({ where: { id: userId }, data: { name, searchName: toSearchText(name) } });
  return { name };
}

/**
 * LGPD, exclusão de dados. Bloqueada apenas enquanto a pessoa fizer parte de um sorteio
 * já realizado (apagar quebraria o amigo secreto de outra pessoa). O banco também garante isso.
 */
export async function deleteMyAccount(userId: string) {
  const completed = await prisma.drawParticipant.count({
    where: { userId, draw: { status: "COMPLETED" } },
  });
  if (completed > 0) {
    throw new AppError(
      "CONFLICT",
      "Você participa de um sorteio já realizado. Para não estragar a brincadeira de ninguém, peça ao organizador para excluir o sorteio depois da troca de presentes. Aí você poderá apagar sua conta.",
    );
  }
  // Cascata: presentes, sessões, códigos e inscrições em sorteios abertos.
  await prisma.user.delete({ where: { id: userId } });
}

/** LGPD, portabilidade: tudo que guardamos sobre a pessoa (sem segredos de terceiros). */
export async function exportMyData(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      role: true,
      createdAt: true,
      emailVerifiedAt: true,
      gifts: { select: { title: true, url: true, description: true, createdAt: true } },
      participations: {
        select: { createdAt: true, draw: { select: { name: true, status: true, eventDate: true } } },
      },
      sessions: { select: { createdAt: true, expiresAt: true } },
    },
  });
  if (!user) throw new AppError("NOT_FOUND", "Conta não encontrada.");
  return { exportedAt: new Date().toISOString(), ...user };
}
