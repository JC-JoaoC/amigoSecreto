import "server-only";
import { hmac } from "./crypto";
import { prisma } from "./db";
import { AppError } from "./errors";

/**
 * Rate limiting de janela fixa guardado no Postgres (funciona com várias instâncias).
 * Os identificadores (e-mail, IP) entram na chave como HMAC: nada legível fica salvo.
 */
export const RATE_LIMITS = {
  loginRequestPerEmail: { limit: 5, windowSeconds: 15 * 60 },
  loginRequestPerIp: { limit: 20, windowSeconds: 15 * 60 },
  verifyPerIp: { limit: 30, windowSeconds: 15 * 60 },
  registerPerIp: { limit: 10, windowSeconds: 60 * 60 },
} as const;

export type RateLimitRule = { limit: number; windowSeconds: number };

export function rateLimitKey(scope: string, identifier: string): string {
  return `${scope}:${hmac("rate-limit", identifier).slice(0, 40)}`;
}

/** Consome 1 unidade. Retorna se ainda está dentro do limite. Operação atômica (1 query). */
export async function consumeRateLimit(
  key: string,
  rule: RateLimitRule,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const now = new Date();
  const windowFloor = new Date(now.getTime() - rule.windowSeconds * 1000);

  const rows = await prisma.$queryRaw<{ count: number; window_start: Date }[]>`
    INSERT INTO "rate_limits" ("key", "count", "window_start")
    VALUES (${key}, 1, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "rate_limits"."window_start" <= ${windowFloor} THEN 1 ELSE "rate_limits"."count" + 1 END,
      "window_start" = CASE WHEN "rate_limits"."window_start" <= ${windowFloor} THEN ${now} ELSE "rate_limits"."window_start" END
    RETURNING "count"::int AS "count", "window_start"
  `;

  const { count, window_start } = rows[0];
  const resetAt = new Date(window_start).getTime() + rule.windowSeconds * 1000;
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - now.getTime()) / 1000));

  // Limpeza oportunista de contadores antigos (~1% das chamadas).
  if (Math.random() < 0.01) {
    void prisma.rateLimit
      .deleteMany({ where: { windowStart: { lt: new Date(now.getTime() - 24 * 3600 * 1000) } } })
      .catch(() => undefined);
  }

  return { allowed: count <= rule.limit, retryAfterSeconds };
}

/** Consome e lança erro amigável se o limite estourou. */
export async function enforceRateLimit(key: string, rule: RateLimitRule): Promise<void> {
  const result = await consumeRateLimit(key, rule);
  if (!result.allowed) {
    const minutes = Math.ceil(result.retryAfterSeconds / 60);
    throw new AppError(
      "RATE_LIMITED",
      `Muitas tentativas em pouco tempo. Tente novamente em ${minutes} ${minutes === 1 ? "minuto" : "minutos"}.`,
    );
  }
}
