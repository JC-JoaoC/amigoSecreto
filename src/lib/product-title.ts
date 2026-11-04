/**
 * Sugere o nome de um produto lendo só o endereço (sem acessar a loja).
 * Muitas lojas colocam o nome no próprio link, ex.:
 *   mercadolivre.com.br/fone-de-ouvido-jbl-tune-520bt/p/MLB25591473
 *   amazon.com.br/Fone-Ouvido-JBL-Tune-520BT/dp/B0C5RH1234
 * Quando o link não traz nome (amzn.to, /dp/CÓDIGO, aliexpress/item/123.html), devolve null.
 */
import { LIMITS } from "./validation";

const IGNORED_SEGMENTS = new Set(["p", "dp", "gp", "product", "produto", "item", "items", "up", "prod", "pd", "s"]);

// Códigos de produto que não fazem parte do nome.
const PRODUCT_CODE = /^(MLB[UA]?\d+|B0[A-Z0-9]{8}|\d{5,})$/i;
// Códigos de SKU no fim do nome (só no modo genérico): "JD8", "006", "6789".
const TRAILING_SKU = /^(?=.*\d)([A-Z0-9]{3,}|\d{3,})$/;

function toUrl(raw: string): URL | null {
  const value = raw.trim();
  if (!value) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function cleanSlug(segment: string, opts: { stripTrailingSku?: boolean } = {}): string | null {
  let s = segment;
  try {
    s = decodeURIComponent(s);
  } catch {
    // mantém como veio
  }
  s = s
    .replace(/\.(html?|aspx|php)$/i, "")
    .replace(/[-_]?_JM$/i, "") // Mercado Livre: "...-_JM"
    .replace(/-i\.\d+\.\d+$/i, "") // Shopee: "Nome-i.123.456"
    .replace(/^MLB[UA]?-?\d+-/i, ""); // Mercado Livre: "MLB-123456789-nome"

  let words = s
    .split(/[-_+\s]+/)
    .filter(Boolean)
    .filter((w) => !PRODUCT_CODE.test(w));

  if (opts.stripTrailingSku) {
    while (words.length > 2 && TRAILING_SKU.test(words[words.length - 1])) words = words.slice(0, -1);
  }

  if (words.length < 2) return null;
  let text = words.join(" ").replace(/\s+/g, " ").trim();
  if (text.length < 6 || !/\p{L}/u.test(text)) return null;

  if (text.length > LIMITS.giftTitleMax) {
    text = text.slice(0, LIMITS.giftTitleMax).replace(/\s+\S*$/, "");
  }
  return text.charAt(0).toLocaleUpperCase("pt-BR") + text.slice(1);
}

export function suggestTitleFromUrl(raw: string): string | null {
  const url = toUrl(raw);
  if (!url) return null;

  const host = url.hostname.toLowerCase().replace(/^(www|m)\./, "");
  const segs = url.pathname.split("/").filter(Boolean);
  if (segs.length === 0) return null;

  /** Segmento imediatamente antes de um marcador, ex.: o nome antes de "/p/". */
  const before = (marker: string) => {
    const i = segs.findIndex((s) => s.toLowerCase() === marker);
    return i > 0 ? segs[i - 1] : undefined;
  };

  if (/(^|\.)amazon\./.test(host)) {
    const slug = before("dp");
    return slug ? cleanSlug(slug) : null;
  }
  if (/(^|\.)mercadoli(vre|bre)\./.test(host)) {
    const slug = before("p") ?? before("up") ?? segs.find((s) => /^MLB[UA]?-?\d+-/i.test(s));
    return slug ? cleanSlug(slug) : null;
  }
  if (/(^|\.)shopee\./.test(host)) {
    const slug = segs.find((s) => /-i\.\d+\.\d+$/i.test(s));
    return slug ? cleanSlug(slug) : null;
  }
  if (/(^|\.)aliexpress\./.test(host)) return null;

  // Kabum, Americanas, Submarino, Shoptime: /produto/123456/nome-do-produto
  if (segs[0]?.toLowerCase() === "produto" && segs[2]) return cleanSlug(segs[2]);

  // Lojas VTEX e afins (Magalu, Casas Bahia, Americanas nova, Netshoes...): /nome-do-produto/p/...
  const vtex = before("p");
  if (vtex) return cleanSlug(vtex);

  // Genérico: o segmento mais longo que pareça um nome.
  const candidate = segs
    .filter((s) => !IGNORED_SEGMENTS.has(s.toLowerCase()))
    .sort((a, b) => b.length - a.length)[0];
  return candidate ? cleanSlug(candidate, { stripTrailingSku: true }) : null;
}
