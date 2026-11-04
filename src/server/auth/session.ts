import "server-only";
import { generateSessionToken, sha256 } from "../crypto";
import { prisma } from "../db";

/**
 * Sessões opacas guardadas no banco. O cookie carrega um token aleatório;
 * o banco guarda só o SHA-256 dele, então um vazamento do banco não permite sequestrar sessões.
 */
export const SESSION_COOKIE = "laco_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias
const SESSION_RENEW_THRESHOLD_MS = 15 * 24 * 60 * 60 * 1000; // renova quando faltar < 15 dias

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: "USER" | "ORGANIZER";
};

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({ data: { id: sha256(token), userId, expiresAt } });
  return { token, expiresAt };
}

export async function validateSessionToken(
  token: string | undefined | null,
): Promise<{ user: SessionUser; expiresAt: Date } | null> {
  if (!token || token.length > 128) return null;
  const id = sha256(token);
  const session = await prisma.session.findUnique({
    where: { id },
    select: {
      expiresAt: true,
      user: { select: { id: true, name: true, email: true, role: true, emailVerifiedAt: true } },
    },
  });
  if (!session) return null;

  const now = Date.now();
  if (session.expiresAt.getTime() <= now || !session.user.emailVerifiedAt) {
    await prisma.session.deleteMany({ where: { id } });
    return null;
  }

  let expiresAt = session.expiresAt;
  if (expiresAt.getTime() - now < SESSION_RENEW_THRESHOLD_MS) {
    expiresAt = new Date(now + SESSION_TTL_MS);
    await prisma.session.update({ where: { id }, data: { expiresAt } });
  }

  const { id: userId, name, email, role } = session.user;
  return { user: { id: userId, name, email, role }, expiresAt };
}

export async function invalidateSession(token: string | undefined | null): Promise<void> {
  if (!token) return;
  await prisma.session.deleteMany({ where: { id: sha256(token) } });
}
