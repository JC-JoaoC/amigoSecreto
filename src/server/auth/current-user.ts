import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { AppError } from "../errors";
import { SESSION_COOKIE, type SessionUser, validateSessionToken } from "./session";

/**
 * Data Access Layer de autenticação. Toda página/ação privada passa por aqui:
 * a sessão é validada no banco em cada requisição (o proxy faz só uma checagem otimista).
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const result = await validateSessionToken(token);
  return result?.user ?? null;
});

/** Para páginas: redireciona ao login quando não há sessão válida. */
export async function requireUser(nextPath?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(nextPath ? `/entrar?next=${encodeURIComponent(nextPath)}` : "/entrar");
  }
  return user;
}

/** Para Server Actions: lança erro (não redireciona) quando não há sessão. */
export async function requireUserForAction(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AppError("UNAUTHENTICATED", "Sua sessão expirou. Entre novamente para continuar.");
  return user;
}

export function isOrganizer(user: SessionUser | null): boolean {
  return user?.role === "ORGANIZER";
}

const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export async function setSessionCookie(token: string, expiresAt: Date) {
  (await cookies()).set(SESSION_COOKIE, token, { ...cookieBase, expires: expiresAt });
}

export async function clearSessionCookie() {
  (await cookies()).set(SESSION_COOKIE, "", { ...cookieBase, maxAge: 0 });
}

export async function getSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

/** IP do cliente (primeiro valor de X-Forwarded-For, definido pelo proxy/CDN da hospedagem). */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip") || "unknown";
}
