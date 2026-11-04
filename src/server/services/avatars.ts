import "server-only";
import sharp from "sharp";
import { prisma } from "../db";
import { AppError } from "../errors";
import { enforceRateLimit, rateLimitKey } from "../rate-limit";

/**
 * Foto de perfil. Toda imagem recebida é reprocessada no servidor:
 * corrige a rotação, recorta em quadrado (focando a parte mais relevante), reduz para 256x256
 * e grava como WebP. Isso remove metadados (como a localização GPS da foto) e recusa
 * arquivos que não são imagem de verdade.
 */
export const AVATAR_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const AVATAR_SIZE = 256;
const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp", "gif", "avif"]);
const UPLOAD_RATE = { limit: 20, windowSeconds: 60 * 60 };

export async function setAvatar(userId: string, bytes: Buffer) {
  await enforceRateLimit(rateLimitKey("avatar:user", userId), UPLOAD_RATE);
  if (bytes.length === 0) throw new AppError("VALIDATION", "Escolha uma foto.");
  if (bytes.length > AVATAR_MAX_UPLOAD_BYTES) {
    throw new AppError("VALIDATION", "A foto é grande demais. Use uma imagem de até 5 MB.");
  }

  let data: Buffer;
  try {
    const image = sharp(bytes, { limitInputPixels: 40_000_000, failOn: "error", animated: false });
    const meta = await image.metadata();
    if (!meta.format || !ACCEPTED_FORMATS.has(meta.format)) throw new Error("formato não aceito");
    data = await image
      .rotate()
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover", position: "attention" })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new AppError("VALIDATION", "Não conseguimos ler essa imagem. Use uma foto JPG, PNG ou WebP.");
  }

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
