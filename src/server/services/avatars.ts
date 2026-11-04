import "server-only";
import { prisma } from "../db";
import { AppError } from "../errors";
import { processImage } from "../images";
import { enforceRateLimit, rateLimitKey } from "../rate-limit";

/**
 * Foto de perfil. Toda imagem recebida é reprocessada no servidor (ver images.ts):
 * corrige a rotação, recorta em quadrado 256x256 e grava como WebP, sem metadados.
 */
export const AVATAR_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const UPLOAD_RATE = { limit: 20, windowSeconds: 60 * 60 };

export async function setAvatar(userId: string, bytes: Buffer) {
  await enforceRateLimit(rateLimitKey("avatar:user", userId), UPLOAD_RATE);
  if (bytes.length > AVATAR_MAX_UPLOAD_BYTES) {
    throw new AppError("VALIDATION", "A foto é grande demais. Use uma imagem de até 5 MB.");
  }
  const data = await processImage(bytes, "avatar");

  const now = new Date();
  await prisma.$transaction([
    prisma.userAvatar.upsert({
      where: { userId },
      create: { userId, data: new Uint8Array(data), mimeType: "image/webp" },
      update: { data: new Uint8Array(data), mimeType: "image/webp" },
    }),
    prisma.user.update({ where: { id: userId }, data: { avatarUpdatedAt: now } }),
  ]);
  return { avatarUpdatedAt: now };
}

export async function removeAvatar(userId: string) {
  await prisma.$transaction([
    prisma.userAvatar.deleteMany({ where: { userId } }),
    prisma.user.update({ where: { id: userId }, data: { avatarUpdatedAt: null } }),
  ]);
}

export async function getAvatar(userId: string) {
  return prisma.userAvatar.findUnique({ where: { userId }, select: { data: true, mimeType: true } });
}
