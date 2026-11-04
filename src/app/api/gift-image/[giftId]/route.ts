import { getGiftImage } from "@/server/services/gift-images";

/**
 * Serve a foto do presente (pública, como a lista). A URL leva a versão (?v=),
 * então o navegador pode guardar em cache por muito tempo.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ giftId: string }> }) {
  const { giftId } = await params;
  if (!/^[a-z0-9]{1,64}$/i.test(giftId)) return new Response(null, { status: 404 });

  const image = await getGiftImage(giftId);
  if (!image) return new Response(null, { status: 404 });

  return new Response(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.mimeType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Content-Disposition": "inline",
    },
  });
}
