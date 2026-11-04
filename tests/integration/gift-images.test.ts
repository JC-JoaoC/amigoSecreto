import sharp from "sharp";
import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/gift-image/[giftId]/route";
import { prisma } from "@/server/db";
import { type FetchDeps, type Fetcher, fetchProductImage } from "@/server/product-image";
import { getGiftImage, previewProductImage, removeGiftImage, setGiftImage } from "@/server/services/gift-images";
import { createGift, deleteGift, listMyGifts } from "@/server/services/gifts";
import { getParticipantWithGifts } from "@/server/services/users";
import { createUser, resetDb } from "../helpers/db";

beforeEach(resetDb);

async function photo(width = 1600, height = 900) {
  return sharp({ create: { width, height, channels: 3, background: "#1f5039" } })
    .jpeg()
    .withMetadata({ exif: { IFD0: { Artist: "dado-sensivel" } } })
    .toBuffer();
}

type Route = { status?: number; headers?: Record<string, string>; body?: BodyInit | null };

/** Internet de mentira: cada URL responde o que o teste mandar; o resto dá 404. */
function fakeWeb(routes: Record<string, Route>, dns: Record<string, string[]> = {}): FetchDeps & { calls: string[] } {
  const calls: string[] = [];
  const fetch: Fetcher = async (url) => {
    calls.push(url.toString());
    const r = routes[url.toString()];
    if (!r) return new Response("não existe", { status: 404 });
    return new Response(r.body ?? null, { status: r.status ?? 200, headers: r.headers });
  };
  const lookup = async (host: string) => (dns[host] ?? ["151.101.1.1"]).map((address) => ({ address }));
  return { fetch, lookup, calls };
}

const STORE = "https://www.kabum.com.br/produto/1/fone";
const IMG = "https://images.kabum.com.br/fone.jpg";
const html = (img: string) => `<html><head><meta property="og:image" content="${img}"></head></html>`;

describe("buscar a foto na loja", () => {
  it("lê a página da loja e baixa a imagem do og:image", async () => {
    const web = fakeWeb({
      [STORE]: { body: html(IMG), headers: { "content-type": "text/html" } },
      [IMG]: { body: new Uint8Array(await photo()), headers: { "content-type": "image/jpeg" } },
    });
    const r = await fetchProductImage(STORE, web);
    expect(r.ok).toBe(true);
    expect(web.calls).toEqual([STORE, IMG]);
  });

  it("não abre sites fora da lista de lojas", async () => {
    const web = fakeWeb({});
    expect(await fetchProductImage("https://www.exemplo.com.br/produto", web)).toEqual({ ok: false, reason: "unsupported_store" });
    expect(await fetchProductImage("http://www.kabum.com.br/produto", web)).toEqual({ ok: false, reason: "unsupported_store" });
    expect(web.calls).toEqual([]);
  });

  it("não segue redirecionamento da loja para fora da lista", async () => {
    const web = fakeWeb({ [STORE]: { status: 302, headers: { location: "https://golpe.example.com/x" } } });
    expect(await fetchProductImage(STORE, web)).toEqual({ ok: false, reason: "error" });
    expect(web.calls).toEqual([STORE]);
  });

  it("não acessa endereço interno, nem da loja nem da imagem", async () => {
    const internalImg = "https://metadata.interno.example/foto.jpg";
    const web = fakeWeb(
      { [STORE]: { body: html(internalImg) }, [internalImg]: { body: new Uint8Array(await photo()) } },
      { "metadata.interno.example": ["169.254.169.254"] },
    );
    expect(await fetchProductImage(STORE, web)).toEqual({ ok: false, reason: "error" });
    expect(web.calls).toEqual([STORE]);

    const loopback = fakeWeb({}, { "www.kabum.com.br": ["127.0.0.1"] });
    expect(await fetchProductImage(STORE, loopback)).toEqual({ ok: false, reason: "error" });
    expect(loopback.calls).toEqual([]);
  });

  it("parede anti-robô ou 403 viram 'bloqueado'; página sem foto vira 'não achou'", async () => {
    const wall = fakeWeb({ [STORE]: { status: 302, headers: { location: "https://www.kabum.com.br/gz/account-verification?go=x" } } });
    expect(await fetchProductImage(STORE, wall)).toEqual({ ok: false, reason: "blocked" });
    expect(await fetchProductImage(STORE, fakeWeb({ [STORE]: { status: 403 } }))).toEqual({ ok: false, reason: "blocked" });
    expect(await fetchProductImage(STORE, fakeWeb({ [STORE]: { body: "<p>nada</p>" } }))).toEqual({ ok: false, reason: "not_found" });
  });

  it("recusa resposta que não é imagem e página grande demais", async () => {
    const notImage = fakeWeb({ [STORE]: { body: html(IMG) }, [IMG]: { body: "<script>", headers: { "content-type": "text/html" } } });
    expect(await fetchProductImage(STORE, notImage)).toEqual({ ok: false, reason: "not_found" });
    const huge = fakeWeb({ [STORE]: { body: "x".repeat(2_100_000) } });
    expect(await fetchProductImage(STORE, huge)).toEqual({ ok: false, reason: "error" });
  });

  it("a prévia volta já reprocessada (WebP, sem metadados)", async () => {
    const u = await createUser();
    const web = fakeWeb({
      [STORE]: { body: html(IMG) },
      [IMG]: { body: new Uint8Array(await photo()), headers: { "content-type": "image/jpeg" } },
    });
    const r = await previewProductImage(u.id, STORE, web);
    expect(r.found).toBe(true);
    if (!r.found) return;
    expect(r.dataUrl.startsWith("data:image/webp;base64,")).toBe(true);
    const bytes = Buffer.from(r.dataUrl.split(",")[1], "base64");
    const meta = await sharp(bytes).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["webp", 480, 270]);
    expect(bytes.toString("latin1")).not.toContain("dado-sensivel");
    expect(await previewProductImage(u.id, "https://www.exemplo.com.br/p", web)).toEqual({ found: false, reason: "unsupported_store" });
  });
});

describe("salvar a foto do presente", () => {
  it("só o dono salva; vira WebP até 480px e aparece na lista", async () => {
    const [ana, bia] = await Promise.all([createUser(), createUser()]);
    const g = await createGift(ana.id, { title: "Fone", url: "https://www.kabum.com.br/p" });

    await expect(setGiftImage(bia.id, g.id, await photo())).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await getGiftImage(g.id)).toBeNull();

    const { imageUpdatedAt } = await setGiftImage(ana.id, g.id, await photo(1000, 2000));
    const saved = await getGiftImage(g.id);
    const meta = await sharp(Buffer.from(saved!.data)).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["webp", 240, 480]);

    const expected = `/api/gift-image/${g.id}?v=${imageUpdatedAt.getTime()}`;
    expect((await listMyGifts(ana.id))[0].imageUrl).toBe(expected);
    expect((await getParticipantWithGifts(ana.id))?.gifts[0].imageUrl).toBe(expected);
  });

  it("recusa arquivo que não é imagem", async () => {
    const u = await createUser();
    const g = await createGift(u.id, { title: "Livro", url: "https://www.exemplo.com.br/livro" });
    await expect(setGiftImage(u.id, g.id, Buffer.from("<svg onload=alert(1)>"))).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(setGiftImage(u.id, g.id, Buffer.alloc(0))).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("remover a foto e excluir o presente apagam a imagem", async () => {
    const [ana, bia] = await Promise.all([createUser(), createUser()]);
    const g = await createGift(ana.id, { title: "Caneca", url: "https://www.exemplo.com.br/caneca" });
    await setGiftImage(ana.id, g.id, await photo());

    await expect(removeGiftImage(bia.id, g.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await getGiftImage(g.id)).not.toBeNull();

    await removeGiftImage(ana.id, g.id);
    expect(await getGiftImage(g.id)).toBeNull();
    expect((await listMyGifts(ana.id))[0].imageUrl).toBeNull();

    await setGiftImage(ana.id, g.id, await photo());
    await deleteGift(ana.id, g.id);
    expect(await prisma.giftImage.count()).toBe(0);
  });

  it("a rota serve a imagem com cabeçalhos seguros", async () => {
    const u = await createUser();
    const g = await createGift(u.id, { title: "Mochila", url: "https://www.exemplo.com.br/mochila" });
    await setGiftImage(u.id, g.id, await photo());

    const ok = await GET(new Request("http://x"), { params: Promise.resolve({ giftId: g.id }) });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("image/webp");
    expect(ok.headers.get("content-security-policy")).toContain("sandbox");

    const missing = await GET(new Request("http://x"), { params: Promise.resolve({ giftId: "naoexiste" }) });
    expect(missing.status).toBe(404);
    const bad = await GET(new Request("http://x"), { params: Promise.resolve({ giftId: "../etc" }) });
    expect(bad.status).toBe(404);
  });
});
