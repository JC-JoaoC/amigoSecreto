import "server-only";
import dns from "node:dns";
import { lookup as dnsLookup } from "node:dns/promises";
import https from "node:https";
import { isIP, type LookupFunction } from "node:net";
import { Readable } from "node:stream";
import zlib from "node:zlib";
import { isStoreUrl } from "@/lib/stores";

/**
 * Busca a foto de um produto lendo a página da loja (a mesma imagem que aparece
 * quando o link é colado no WhatsApp: og:image / twitter:image / JSON-LD).
 *
 * Proteções contra uso do servidor para acessar o que não deve (SSRF):
 *  - a página só é aberta se for de uma loja da lista;
 *  - só HTTPS; redirecionamentos seguidos um a um e revalidados;
 *  - todo endereço é resolvido e recusado se apontar para rede interna/privada;
 *  - limite de tempo e de tamanho em cada download.
 */

const USER_AGENT = "Mozilla/5.0 (compatible; LacoLinkPreview/1.0; amigo secreto)";
const MAX_HTML_BYTES = 2_000_000;
const MAX_IMAGE_BYTES = 8_000_000;
const MAX_REDIRECTS = 3;

/** Recusa loopback, redes privadas, link-local, CGNAT, multicast e afins (IPv4 e IPv6). */
export function isPublicAddress(address: string): boolean {
  const v = isIP(address);
  if (v === 4) {
    const [a, b] = address.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127) return false;
    if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT
    if (a === 169 && b === 254) return false; // link-local
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 192 && b === 0) return false;
    if (a === 198 && (b === 18 || b === 19)) return false;
    if (a >= 224) return false; // multicast e reservados
    return true;
  }
  if (v === 6) {
    const ip = address.toLowerCase();
    if (ip === "::" || ip === "::1") return false;
    if (ip.startsWith("::ffff:")) return isPublicAddress(ip.slice(7)); // IPv4 mapeado
    if (/^f[cd]/.test(ip)) return false; // fc00::/7 (privado)
    if (/^fe[89ab]/.test(ip)) return false; // fe80::/10 (link-local)
    if (ip.startsWith("ff")) return false; // multicast
    return true;
  }
  return false;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#x2F;/gi, "/")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function toAbsolute(candidate: string | undefined | null, base: string): string | null {
  if (!candidate) return null;
  try {
    const url = new URL(decodeEntities(candidate.trim()), base);
    if (url.protocol === "http:") url.protocol = "https:"; // só baixamos por HTTPS
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Encontra a imagem principal do produto no HTML (sem executar nada da página). */
export function extractImageUrl(html: string, pageUrl: string): string | null {
  const head = html.slice(0, 600_000);
  const metaTags = head.match(/<meta\b[^>]*>/gi) ?? [];
  const wanted = ["og:image:secure_url", "og:image", "og:image:url", "twitter:image", "twitter:image:src"];
  for (const key of wanted) {
    for (const tag of metaTags) {
      const name = /(?:property|name|itemprop)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
      if (name !== key) continue;
      const content = /content\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
      const abs = toAbsolute(content, pageUrl);
      if (abs) return abs;
    }
  }
  const imageSrc = /<link\b[^>]*rel\s*=\s*["']image_src["'][^>]*>/i.exec(head)?.[0];
  if (imageSrc) {
    const abs = toAbsolute(/href\s*=\s*["']([^"']+)["']/i.exec(imageSrc)?.[1], pageUrl);
    if (abs) return abs;
  }
  // JSON-LD de produto: "image": "url" | ["url", ...] | {"url": "..."}
  for (const block of head.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) ?? []) {
    const m = /"image"\s*:\s*(?:\[\s*)?(?:\{\s*"url"\s*:\s*)?"([^"]+)"/i.exec(block);
    const abs = toAbsolute(m?.[1]?.replace(/\\\//g, "/"), pageUrl);
    if (abs) return abs;
  }
  return null;
}

type Lookup = (host: string) => Promise<{ address: string }[]>;
export type Fetcher = (url: URL, init: { headers: Record<string, string>; signal: AbortSignal }) => Promise<Response>;
export type FetchDeps = { fetch?: Fetcher; lookup?: Lookup; timeoutMs?: number };

class Blocked extends Error {}

/** Páginas de verificação anti-robô: a loja não quer ser lida automaticamente, então paramos. */
const BOT_WALL = /captcha|account-verification|challenge|robot-check|blocked/i;

const defaultLookup: Lookup = (host) => dnsLookup(host, { all: true, verbatim: true });

/**
 * Resolução de nomes usada na conexão de verdade: recusa o endereço na hora de conectar.
 * Assim um domínio não consegue responder "IP público" na checagem e "IP interno" no download.
 */
const connectLookup: LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    const cb = callback as (e: Error | null, a: string | dns.LookupAddress[], f?: number) => void;
    if (err) return cb(err, "", 4);
    if (addresses.length === 0 || addresses.some((a) => !isPublicAddress(a.address))) {
      return cb(new Error("endereço interno"), "", 4);
    }
    if (options.all) return cb(null, addresses);
    cb(null, addresses[0].address, addresses[0].family);
  });
};

/** GET por HTTPS com a resolução protegida acima. Não segue redirecionamentos (quem chama decide). */
const pinnedFetch: Fetcher = (url, init) =>
  new Promise((resolve, reject) => {
    const req = https.request(url, { method: "GET", headers: init.headers, lookup: connectLookup, signal: init.signal }, (res) => {
      const status = res.statusCode ?? 502;
      const headers = new Headers();
      for (const [key, value] of Object.entries(res.headers)) {
        if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
      }
      if (status < 200 || status >= 300) {
        res.resume();
        resolve(new Response(null, { status, headers }));
        return;
      }
      // Não pedimos compressão, mas alguns servidores mandam assim mesmo.
      const encoding = (res.headers["content-encoding"] ?? "").toLowerCase();
      const stream =
        encoding === "gzip" ? res.pipe(zlib.createGunzip())
        : encoding === "br" ? res.pipe(zlib.createBrotliDecompress())
        : encoding === "deflate" ? res.pipe(zlib.createInflate())
        : res;
      headers.delete("content-length");
      resolve(new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, { status, headers }));
    });
    req.on("error", reject);
    req.end();
  });

async function assertPublicHost(hostname: string, lookup: Lookup) {
  if (isIP(hostname)) {
    if (!isPublicAddress(hostname)) throw new Error("endereço interno");
    return;
  }
  const addresses = await lookup(hostname);
  if (addresses.length === 0 || addresses.some((a) => !isPublicAddress(a.address))) {
    throw new Error("endereço interno");
  }
}

async function readCapped(res: Response, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new Error("grande demais");
  if (!res.body) return new Uint8Array(await res.arrayBuffer()).slice(0, maxBytes);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("grande demais");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

async function safeGet(
  start: URL,
  opts: { accept: string; maxBytes: number; storeOnly: boolean },
  deps: Required<FetchDeps>,
  signal: AbortSignal,
): Promise<{ body: Uint8Array; contentType: string; finalUrl: URL }> {
  let current = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (current.protocol !== "https:") throw new Error("só https");
    if (opts.storeOnly && !isStoreUrl(current)) throw new Error("fora da lista de lojas");
    await assertPublicHost(current.hostname, deps.lookup);

    const res = await deps.fetch(current, {
      headers: { "User-Agent": USER_AGENT, Accept: opts.accept, "Accept-Language": "pt-BR,pt;q=0.9" },
      signal,
    });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new Error("redirecionamento sem destino");
      current = new URL(location, current);
      if (opts.storeOnly && BOT_WALL.test(current.pathname)) throw new Blocked();
      continue;
    }
    if (res.status === 202 || res.status === 403 || res.status === 429 || res.status === 503) throw new Blocked();
    if (!res.ok) throw new Error(`status ${res.status}`);
    return { body: await readCapped(res, opts.maxBytes), contentType: res.headers.get("content-type") ?? "", finalUrl: current };
  }
  throw new Error("redirecionamentos demais");
}

export type ProductImageResult =
  | { ok: true; bytes: Buffer }
  | { ok: false; reason: "unsupported_store" | "not_found" | "blocked" | "error" };

export async function fetchProductImage(rawUrl: string, deps: FetchDeps = {}): Promise<ProductImageResult> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "error" };
  }
  if (!isStoreUrl(url)) return { ok: false, reason: "unsupported_store" };

  const full: Required<FetchDeps> = { fetch: deps.fetch ?? pinnedFetch, lookup: deps.lookup ?? defaultLookup, timeoutMs: deps.timeoutMs ?? 8000 };
  // Um prazo só para tudo (página, redirecionamentos e imagem).
  const signal = AbortSignal.timeout(full.timeoutMs);
  try {
    const page = await safeGet(url, { accept: "text/html,application/xhtml+xml", maxBytes: MAX_HTML_BYTES, storeOnly: true }, full, signal);
    const imageUrl = extractImageUrl(new TextDecoder("utf-8").decode(page.body), page.finalUrl.toString());
    if (!imageUrl) return { ok: false, reason: "not_found" };
    // A imagem costuma estar num CDN da loja: não exige a lista, mas mantém as demais proteções.
    const image = await safeGet(new URL(imageUrl), { accept: "image/avif,image/webp,image/*", maxBytes: MAX_IMAGE_BYTES, storeOnly: false }, full, signal);
    if (!image.contentType.toLowerCase().startsWith("image/")) return { ok: false, reason: "not_found" };
    return { ok: true, bytes: Buffer.from(image.body) };
  } catch (error) {
    return { ok: false, reason: error instanceof Blocked ? "blocked" : "error" };
  }
}
