/**
 * Lojas cuja página o servidor pode abrir para buscar a foto do produto.
 * Fica numa lista fechada de propósito: o servidor nunca abre um endereço qualquer.
 */
export const STORE_DOMAINS = [
  "mercadolivre.com.br",
  "mercadolibre.com",
  "amazon.com.br",
  "amazon.com",
  "magazineluiza.com.br",
  "magalu.com",
  "americanas.com.br",
  "submarino.com.br",
  "shoptime.com.br",
  "casasbahia.com.br",
  "pontofrio.com.br",
  "extra.com.br",
  "kabum.com.br",
  "shopee.com.br",
  "netshoes.com.br",
  "centauro.com.br",
  "dafiti.com.br",
  "zattini.com.br",
  "fastshop.com.br",
  "carrefour.com.br",
  "leroymerlin.com.br",
  "decathlon.com.br",
  "renner.com.br",
  "riachuelo.com.br",
  "cea.com.br",
  "sephora.com.br",
  "boticario.com.br",
  "natura.com.br",
  "estantevirtual.com.br",
];

/** HTTPS, sem usuário/senha/porta e com domínio da lista (ou subdomínio dele). */
export function isStoreUrl(input: string | URL): boolean {
  let url: URL;
  try {
    url = typeof input === "string" ? new URL(input.trim()) : input;
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  const host = url.hostname.toLowerCase();
  return STORE_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
}
