import { getAvatar } from "@/server/services/avatars";

/**
 * Serve a foto de perfil (pública, como o nome). A URL leva a versão (?v=),
 * então o navegador pode guardar em cache por muito tempo.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  if (!/^[a-z0-9]{1,64}$/i.test(userId)) return new Response(null, { status: 404 });

  const avatar = await getAvatar(userId);
  if (!avatar) return new Response(null, { status: 404 });

  return new Response(new Uint8Array(avatar.data), {
    headers: {
      "Content-Type": avatar.mimeType,
      "Cache-Control": "public, max-age=31536000, immutable",
      // Mesmo sendo reprocessada, a imagem é servida sem poder executar nada.
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Content-Disposition": "inline",
    },
  });
}
