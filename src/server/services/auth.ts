import "server-only";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/validation";
import { toSearchText } from "@/lib/text";
import { createSession } from "../auth/session";
import { generateSessionToken, sha256 } from "../crypto";
import { prisma } from "../db";
import { env, isOrganizerEmail } from "../env";
import { AppError } from "../errors";
import { sendMail } from "../mail/mailer";
import { passwordResetEmail, verifyEmailEmail } from "../mail/templates";
import { burnPasswordCheck, hashPassword, verifyPassword } from "../password";
import { RATE_LIMITS, enforceRateLimit, rateLimitKey } from "../rate-limit";
import { parseOrThrow } from "../validate";

/**
 * Autenticação por e-mail + senha.
 *  - Senha guardada só como hash scrypt; login com mensagem genérica e limite de tentativas.
 *  - "Esqueci minha senha": link de uso único por e-mail (30 min).
 *  - Confirmação de e-mail: link enviado no cadastro. Opcional para participar,
 *    obrigatória para virar organizador (impede alguém de se cadastrar com o e-mail do organizador).
 */
export const RESET_TTL_MINUTES = 30;
export const VERIFY_TTL_HOURS = 48;

const invalidCredentials = () => new AppError("INVALID_CREDENTIALS", "E-mail ou senha incorretos.");
const invalidToken = () =>
  new AppError("TOKEN_INVALID", "Este link expirou ou já foi usado. Peça um novo para continuar.");

function appUrl(path: string) {
  return `${env().APP_URL.replace(/\/$/, "")}${path}`;
}

/** Cria um link de uso único e invalida os anteriores da mesma finalidade. */
async function issueToken(userId: string, purpose: "RESET_PASSWORD" | "VERIFY_EMAIL", ttlMs: number) {
  const token = generateSessionToken();
  const now = new Date();
  await prisma.$transaction([
    prisma.authToken.updateMany({ where: { userId, purpose, usedAt: null }, data: { usedAt: now } }),
    prisma.authToken.create({
      data: { userId, purpose, tokenHash: sha256(token), expiresAt: new Date(now.getTime() + ttlMs) },
    }),
  ]);
  return token;
}

/** Consome um link: só funciona uma vez, dentro da validade, para a finalidade certa. */
async function consumeToken(token: string, purpose: "RESET_PASSWORD" | "VERIFY_EMAIL") {
  const now = new Date();
  const row = await prisma.authToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row || row.purpose !== purpose || row.usedAt || row.expiresAt <= now) throw invalidToken();
  const used = await prisma.authToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: now } });
  if (used.count === 0) throw invalidToken();
  return row.userId;
}

/** Organizador só com e-mail confirmado: prova de que a pessoa é dona do endereço da lista. */
async function promoteIfOrganizer(user: { id: string; email: string; role: string; emailVerifiedAt: Date | null }) {
  if (user.role !== "ORGANIZER" && user.emailVerifiedAt && isOrganizerEmail(user.email)) {
    await prisma.user.update({ where: { id: user.id }, data: { role: "ORGANIZER" } });
  }
}

async function sendVerification(user: { id: string; name: string; email: string }) {
  const token = await issueToken(user.id, "VERIFY_EMAIL", VERIFY_TTL_HOURS * 3600 * 1000);
  await sendMail(verifyEmailEmail({ to: user.email, name: user.name, url: appUrl(`/confirmar-email?token=${token}`) }));
}

// ───────────────────────────── Cadastro e login ─────────────────────────────

export async function registerUser(input: { name: unknown; email: unknown; password: unknown }, ip: string) {
  const data = parseOrThrow(registerSchema, input);
  await enforceRateLimit(rateLimitKey("register:ip", ip), RATE_LIMITS.registerPerIp);

  const existing = await prisma.user.findUnique({ where: { email: data.email }, select: { id: true } });
  if (existing) {
    throw new AppError("CONFLICT", "Este e-mail já tem cadastro. Entre com sua senha ou crie uma nova em “Esqueci minha senha”.", {
      email: ["Este e-mail já tem cadastro."],
    });
  }

  const user = await prisma.user.create({
    data: {
      name: data.name,
      searchName: toSearchText(data.name),
      email: data.email,
      passwordHash: await hashPassword(data.password),
    },
  });

  // Confirmação de e-mail: se o envio falhar, a conta continua funcionando.
  try {
    await sendVerification(user);
  } catch (error) {
    console.error("[auth] falha ao enviar confirmação de e-mail:", (error as Error).message);
  }

  const session = await createSession(user.id);
  return { userId: user.id, ...session };
}

export async function loginWithPassword(input: { email: unknown; password: unknown }, ip: string) {
  const data = parseOrThrow(loginSchema, input);
  await enforceRateLimit(rateLimitKey("login:ip", ip), RATE_LIMITS.loginPerIp);
  await enforceRateLimit(rateLimitKey("login:email", data.email), RATE_LIMITS.loginPerEmail);

  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user?.passwordHash) {
    await burnPasswordCheck(data.password); // mesmo tempo de resposta com ou sem conta
    throw invalidCredentials();
  }
  if (!(await verifyPassword(data.password, user.passwordHash))) throw invalidCredentials();

  await promoteIfOrganizer(user);
  const session = await createSession(user.id);
  return { userId: user.id, ...session };
}

// ───────────────────────────── Esqueci minha senha ─────────────────────────────

/** Sempre responde igual, exista ou não a conta (não revela quais e-mails estão cadastrados). */
export async function requestPasswordReset(input: { email: unknown }, ip: string) {
  const { email } = parseOrThrow(forgotPasswordSchema, input);
  await enforceRateLimit(rateLimitKey("reset:ip", ip), RATE_LIMITS.resetPerIp);
  await enforceRateLimit(rateLimitKey("reset:email", email), RATE_LIMITS.resetPerEmail);

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, email: true } });
  if (!user) return { email };

  const token = await issueToken(user.id, "RESET_PASSWORD", RESET_TTL_MINUTES * 60 * 1000);
  try {
    await sendMail(
      passwordResetEmail({ to: user.email, name: user.name, url: appUrl(`/redefinir-senha?token=${token}`), minutes: RESET_TTL_MINUTES }),
    );
  } catch (error) {
    console.error("[auth] falha ao enviar link de nova senha:", (error as Error).message);
    throw new AppError("EMAIL_FAILED", "Não conseguimos enviar o e-mail agora. Tente novamente em instantes.");
  }
  return { email };
}

/** Define a nova senha, encerra todas as sessões antigas e já entra na conta. */
export async function resetPassword(input: { token: unknown; password: unknown }) {
  const data = parseOrThrow(resetPasswordSchema, input);
  const userId = await consumeToken(data.token, "RESET_PASSWORD");
  const now = new Date();
  const passwordHash = await hashPassword(data.password);

  const before = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const [, , updated] = await prisma.$transaction([
    prisma.session.deleteMany({ where: { userId } }),
    prisma.authToken.updateMany({ where: { userId, purpose: "RESET_PASSWORD", usedAt: null }, data: { usedAt: now } }),
    // O link chegou no e-mail: isso também confirma o endereço.
    prisma.user.update({ where: { id: userId }, data: { passwordHash, emailVerifiedAt: before.emailVerifiedAt ?? now } }),
  ]);

  await promoteIfOrganizer(updated);
  const session = await createSession(userId);
  return { userId, ...session };
}

// ───────────────────────────── Confirmação de e-mail ─────────────────────────────

export async function confirmEmail(input: { token: unknown }) {
  const token = typeof input.token === "string" ? input.token.trim() : "";
  if (token.length < 20 || token.length > 200) throw invalidToken();
  const userId = await consumeToken(token, "VERIFY_EMAIL");
  const before = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const user = await prisma.user.update({
    where: { id: userId },
    data: { emailVerifiedAt: before.emailVerifiedAt ?? new Date() },
  });
  await promoteIfOrganizer(user);
  const fresh = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { role: true, email: true } });
  return { email: fresh.email, isOrganizer: fresh.role === "ORGANIZER" };
}

export async function resendVerification(userId: string) {
  await enforceRateLimit(rateLimitKey("verify:user", userId), RATE_LIMITS.verifyResendPerUser);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.emailVerifiedAt) return { alreadyVerified: true };
  try {
    await sendVerification(user);
  } catch (error) {
    console.error("[auth] falha ao reenviar confirmação:", (error as Error).message);
    throw new AppError("EMAIL_FAILED", "Não conseguimos enviar o e-mail agora. Tente novamente em instantes.");
  }
  return { alreadyVerified: false };
}

// ───────────────────────────── Troca de senha ─────────────────────────────

/** Troca a senha logado: exige a atual e encerra as outras sessões (mantém a atual). */
export async function changePassword(userId: string, currentSessionToken: string | undefined, input: unknown) {
  const data = parseOrThrow(changePasswordSchema, input);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(data.current, user.passwordHash))) {
    throw new AppError("INVALID_CREDENTIALS", "A senha atual não confere.", { current: ["A senha atual não confere."] });
  }
  const passwordHash = await hashPassword(data.password);
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
    prisma.session.deleteMany({
      where: { userId, ...(currentSessionToken ? { id: { not: sha256(currentSessionToken) } } : {}) },
    }),
  ]);
}
