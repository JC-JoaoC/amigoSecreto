/** Formato padrão de retorno das Server Actions (serializável para o cliente). */
export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/** Aceita apenas caminhos internos — evita "open redirect" via ?next=https://site-malicioso. */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (next.length > 512) return fallback;
  return next;
}
