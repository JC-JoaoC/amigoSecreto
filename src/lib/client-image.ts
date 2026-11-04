/**
 * Reduz a foto no próprio navegador antes de enviar (upload leve, sem metadados).
 *  - square: recorta o centro em quadrado (foto de perfil);
 *  - senão: cabe inteira num quadrado de `size` px (foto de produto, sem cortar).
 * O servidor reprocessa de novo: isso aqui é só para o envio ser rápido.
 */
export async function resizeImage(file: Blob, size: number, square = false): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  let sx = 0;
  let sy = 0;
  let sw = bitmap.width;
  let sh = bitmap.height;
  let outW: number;
  let outH: number;
  if (square) {
    const side = Math.min(bitmap.width, bitmap.height);
    sx = (bitmap.width - side) / 2;
    sy = (bitmap.height - side) / 2;
    sw = sh = side;
    outW = outH = Math.min(size, side);
  } else {
    const scale = Math.min(1, size / Math.max(bitmap.width, bitmap.height));
    outW = Math.max(1, Math.round(bitmap.width * scale));
    outH = Math.max(1, Math.round(bitmap.height * scale));
  }
  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas indisponível");
  if (!square) {
    // Fundo branco: PNG transparente de produto não fica preto ao virar JPEG.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, outW, outH);
  }
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, outW, outH);
  bitmap.close();
  const toBlob = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));
  let blob = await toBlob("image/webp");
  if (!blob || blob.type !== "image/webp") blob = await toBlob("image/jpeg"); // navegadores sem WebP
  if (!blob) throw new Error("não foi possível gerar a imagem");
  return blob;
}

/** Converte a pré-visualização (data URL base64) de volta em arquivo para enviar. Sem fetch: a CSP não libera data:. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(",");
  const type = /^data:([^;,]+)/.exec(dataUrl)?.[1] ?? "application/octet-stream";
  const binary = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}
