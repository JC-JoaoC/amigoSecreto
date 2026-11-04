import "server-only";
import sharp from "sharp";
import { AppError } from "./errors";

/**
 * Processamento único de imagens enviadas ou baixadas: decodifica e regrava como WebP.
 * Isso descarta arquivos que não são imagem de verdade e apaga metadados (EXIF, GPS).
 *  - avatar: quadrado 256x256, recorte focando a parte mais relevante;
 *  - product: cabe em 480x480 sem cortar o produto e sem aumentar imagens pequenas.
 */
export const IMAGE_MAX_INPUT_BYTES = 8 * 1024 * 1024;
const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp", "gif", "avif"]);

export async function processImage(bytes: Buffer, kind: "avatar" | "product"): Promise<Buffer> {
  if (bytes.length === 0) throw new AppError("VALIDATION", "Escolha uma foto.");
  if (bytes.length > IMAGE_MAX_INPUT_BYTES) {
    throw new AppError("VALIDATION", "A foto é grande demais. Use uma imagem de até 8 MB.");
  }
  try {
    const image = sharp(bytes, { limitInputPixels: 40_000_000, failOn: "error", animated: false });
    const meta = await image.metadata();
    if (!meta.format || !ACCEPTED_FORMATS.has(meta.format)) throw new Error("formato não aceito");
    const oriented = image.rotate();
    const resized =
      kind === "avatar"
        ? oriented.resize(256, 256, { fit: "cover", position: "attention" })
        : oriented.resize(480, 480, { fit: "inside", withoutEnlargement: true });
    return await resized.webp({ quality: kind === "avatar" ? 82 : 80 }).toBuffer();
  } catch {
    throw new AppError("VALIDATION", "Não conseguimos ler essa imagem. Use uma foto JPG, PNG ou WebP.");
  }
}
