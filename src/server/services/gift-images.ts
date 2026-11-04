import "server-only";
import { idSchema } from "@/lib/validation";
import { isStoreUrl } from "@/lib/stores";
import { prisma } from "../db";
import { AppError } from "../errors";
import { processImage } from "../images";
import { type FetchDeps, fetchProductImage } from "../product-image";
import { enforceRateLimit, rateLimitKey } from "../rate-limit";
import { parseOrThrow } from "../validate";

/**
 * Foto do produto. Vem de dois jeitos:
 *  - buscada na página da loja (só lojas da lista, ver product-image.ts);
 *  - enviada pela própria pessoa.
 * Nos dois casos a imagem é reprocessada aqui (WebP, até 480x480, sem metadados)
 * e guardada no nosso banco: o site nunca carrega imagem direto da loja.
 */

const PREVIEW_RATE = { limit: 40, windowSeconds: 60 * 60 };
const UPLOAD_RATE = { limit: 60, windowSeconds: 60 * 60 };

export type PreviewResult =
  | { found: true; dataUrl: string }
  | { found: false; reason: "unsupported_store" | "not_found" | "blocked" | "error" | "disabled" };

/** Busca a foto na loja e devolve já processada, para a pessoa ver antes de salvar. */
export async function previewProductImage(userId: string, rawUrl: unknown, deps?: FetchDeps): Promise<PreviewResult> {
  if (typeof rawUrl !== "string" || rawUrl.length > 2048 || !isStoreUrl(rawUrl)) {
    return { found: false, reason: "unsupported_store" };
  }
  if (process.env.PRODUCT_IMAGE_FETCH === "off" && !deps) return { found: false, reason: "disabled" };
  await enforceRateLimit(rateLimitKey("gift-image-preview:user", userId), PREVIEW_RATE);

  const result = await fetchProductImage(rawUrl.trim(), deps);
  if (!result.ok) return { found: false, reason: result.reason };
  try {
    const webp = await processImage(result.bytes, "product");
    return { found: true, dataUrl: `data:image/webp;base64,${webp.toString("base64")}` };
  } catch {
    return { found: false, reason: "not_found" };
  }
}

export async function setGiftImage(userId: string, giftId: unknown, bytes: Buffer) {
  const id = parseOrThrow(idSchema, giftId);
  await enforceRateLimit(rateLimitKey("gift-image:user", userId), UPLOAD_RATE);
  const data = await processImage(bytes, "product");
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    // Dono conferido na própria escrita: sem janela entre checar e alterar.
    const owned = await tx.gift.updateMany({ where: { id, userId }, data: { imageUpdatedAt: now } });
    if (owned.count === 0) throw new AppError("NOT_FOUND", "Presente não encontrado na sua lista.");
    await tx.giftImage.upsert({
      where: { giftId: id },
      create: { giftId: id, data: new Uint8Array(data), mimeType: "image/webp" },
      update: { data: new Uint8Array(data), mimeType: "image/webp" },
    });
    return { imageUpdatedAt: now };
  });
}

export async function removeGiftImage(userId: string, giftId: unknown) {
  const id = parseOrThrow(idSchema, giftId);
  await prisma.$transaction(async (tx) => {
    const owned = await tx.gift.updateMany({ where: { id, userId }, data: { imageUpdatedAt: null } });
    if (owned.count === 0) throw new AppError("NOT_FOUND", "Presente não encontrado na sua lista.");
    await tx.giftImage.deleteMany({ where: { giftId: id } });
  });
}

export async function getGiftImage(giftId: string) {
  return prisma.giftImage.findUnique({ where: { giftId }, select: { data: true, mimeType: true } });
}
