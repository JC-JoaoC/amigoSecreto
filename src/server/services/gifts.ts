import "server-only";
import { LIMITS, giftInputSchema, idSchema } from "@/lib/validation";
import { prisma } from "../db";
import { AppError } from "../errors";
import { parseOrThrow } from "../validate";

/**
 * Presentes: qualquer pessoa vê, mas só o dono cria/edita/exclui.
 * A propriedade é verificada na própria query (where: { id, userId }),
 * então não existe janela entre "checar" e "alterar".
 */

const giftSelect = { id: true, title: true, url: true, description: true, createdAt: true, updatedAt: true } as const;

export async function listMyGifts(userId: string) {
  return prisma.gift.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, select: giftSelect });
}

export async function createGift(userId: string, input: unknown) {
  const data = parseOrThrow(giftInputSchema, input);
  const count = await prisma.gift.count({ where: { userId } });
  if (count >= LIMITS.giftsPerUser) {
    throw new AppError("LIMIT_REACHED", `Você chegou ao limite de ${LIMITS.giftsPerUser} presentes. Remova algum para adicionar outro.`);
  }
  return prisma.gift.create({ data: { ...data, userId }, select: giftSelect });
}

export async function updateGift(userId: string, giftId: unknown, input: unknown) {
  const id = parseOrThrow(idSchema, giftId);
  const data = parseOrThrow(giftInputSchema, input);
  const result = await prisma.gift.updateMany({ where: { id, userId }, data });
  if (result.count === 0) throw new AppError("NOT_FOUND", "Presente não encontrado na sua lista.");
  return prisma.gift.findUniqueOrThrow({ where: { id }, select: giftSelect });
}

export async function deleteGift(userId: string, giftId: unknown) {
  const id = parseOrThrow(idSchema, giftId);
  const result = await prisma.gift.deleteMany({ where: { id, userId } });
  if (result.count === 0) throw new AppError("NOT_FOUND", "Presente não encontrado na sua lista.");
}
