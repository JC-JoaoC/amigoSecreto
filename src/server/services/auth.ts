import "server-only";
import { codeSchema, emailSchema, registerSchema } from "@/lib/validation";
import { toSearchText } from "@/lib/text";
import { generateLoginCode, hmac, safeEqualHex } from "../crypto";
import { prisma } from "../db";
import { organizerEmails } from "../env";
import { AppError } from "../errors";
import { sendMail } from "../mail/mailer";
import { loginCodeEmail } from "../mail/templates";
import { RATE_LIMITS, enforceRateLimit, rateLimitKey } from "../rate-limit";
import { createSession } from "../auth/session";
import { parseOrThrow } from "../validate";

export const LOGIN_CODE_TTL_MINUTES = 10;
export const LOGIN_CODE_MAX_ATTEMPTS = 5;

function hashCode(userId: string, code: string): string {
  // O userId entra no HMAC: o mesmo código para outra pessoa gera outro hash.
  return hmac("login-code", `${userId}:${code}`);
}

/**
 * Cadastro: cria a conta (ainda não verificada). A conta só passa a valer
 * — e só aparece na lista pública — depois que a pessoa confirma o código do e-mail.
 * Uma conta não verificada pode ser "reivindicada" de novo (evita alguém travar o e-mail alheio).
 */
export async function registerUser(input: { name: unknown; email: unknown }, ip: string) {
  const data = parseOrThrow(registerSchema, input);
  await enforceRateLimit(rateLimitKey("register:ip", ip), RATE_LIMITS.registerPerIp);
  // Mesmo limite do login por e-mail: impede encher a caixa de alguém trocando de IP.
  await enforceRateLimit(rateLimitKey("login:email", data.email), RATE_LIMITS.loginRequestPerEmail);

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing?.emailVerifiedAt) {
    throw new AppError("CONFLICT", "Este e-mail já tem cadastro. Que tal entrar?", {
      email: ["Este e-mail já tem cadastro."],
    });
  }

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { name: data.name, searchName: toSearchText(data.name) },
      })
    : await prisma.user.create({
        data: { name: data.name, searchName: toSearchText(data.name), email: data.email },
      });

  await issueLoginCode(user);
  return { email: user.email };
}

/**
 * Login passo 1: envia código para um e-mail cadastrado.
 * Retorna "not_found" para que a interface ofereça o cadastro.
 */
export async function requestLoginCode(input: { email: unknown }, ip: string) {
  const email = parseOrThrow(emailSchema, input.email);
  await enforceRateLimit(rateLimitKey("login:ip", ip), RATE_LIMITS.loginRequestPerIp);
  await enforceRateLimit(rateLimitKey("login:email", email), RATE_LIMITS.loginRequestPerEmail);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { status: "not_found" as const, email };

  await issueLoginCode(user);
  return { status: "sent" as const, email };
}

async function issueLoginCode(user: { id: string; name: string; email: string }) {
  const code = generateLoginCode();
  const now = new Date();

  // Uso único: qualquer código anterior ainda válido deixa de funcionar.
  await prisma.$transaction([
    prisma.loginCode.updateMany({
      where: { userId: user.id, consumedAt: null },
      data: { consumedAt: now },
    }),
    prisma.loginCode.create({
      data: {
        userId: user.id,
        codeHash: hashCode(user.id, code),
        expiresAt: new Date(now.getTime() + LOGIN_CODE_TTL_MINUTES * 60 * 1000),
      },
    }),
  ]);

  try {
    await sendMail(loginCodeEmail({ to: user.email, name: user.name, code, minutes: LOGIN_CODE_TTL_MINUTES }));
  } catch (error) {
    console.error("[auth] falha ao enviar e-mail de código:", (error as Error).message);
    throw new AppError("EMAIL_FAILED", "Não conseguimos enviar o e-mail agora. Tente novamente em instantes.");
  }
}

/**
 * Login passo 2: confere o código e cria a sessão.
 * Protegido por: expiração (10 min), uso único, máx. 5 tentativas por código,
 * rate limit por IP e comparação em tempo constante.
 */
export async function verifyLoginCode(input: { email: unknown; code: unknown }, ip: string) {
  const email = parseOrThrow(emailSchema, input.email);
  const code = parseOrThrow(codeSchema, input.code);
  await enforceRateLimit(rateLimitKey("verify:ip", ip), RATE_LIMITS.verifyPerIp);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new AppError("CODE_INVALID", "Código inválido. Confira o e-mail e tente de novo.");

  const now = new Date();
  const loginCode = await prisma.loginCode.findFirst({
    where: { userId: user.id, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!loginCode || loginCode.expiresAt <= now) {
    throw new AppError("CODE_EXPIRED", "Este código expirou. Peça um novo para continuar.");
  }

  // Incremento atômico: duas tentativas simultâneas não "furam" o limite.
  const counted = await prisma.loginCode.updateMany({
    where: { id: loginCode.id, consumedAt: null, attempts: { lt: LOGIN_CODE_MAX_ATTEMPTS } },
    data: { attempts: { increment: 1 } },
  });
  if (counted.count === 0) {
    await prisma.loginCode.updateMany({ where: { id: loginCode.id, consumedAt: null }, data: { consumedAt: now } });
    throw new AppError("CODE_LOCKED", "Muitas tentativas com este código. Peça um novo.");
  }
  const attemptsUsed = loginCode.attempts + 1;

  if (!safeEqualHex(loginCode.codeHash, hashCode(user.id, code))) {
    const left = LOGIN_CODE_MAX_ATTEMPTS - attemptsUsed;
    if (left <= 0) {
      await prisma.loginCode.updateMany({ where: { id: loginCode.id, consumedAt: null }, data: { consumedAt: now } });
      throw new AppError("CODE_LOCKED", "Muitas tentativas com este código. Peça um novo.");
    }
    throw new AppError(
      "CODE_INVALID",
      `Código incorreto. Você ainda tem ${left} ${left === 1 ? "tentativa" : "tentativas"}.`,
    );
  }

  // Consome o código (só uma requisição vence, mesmo em paralelo).
  const consumed = await prisma.loginCode.updateMany({
    where: { id: loginCode.id, consumedAt: null },
    data: { consumedAt: now },
  });
  if (consumed.count === 0) {
    throw new AppError("CODE_EXPIRED", "Este código já foi usado. Peça um novo.");
  }

  const shouldBeOrganizer = organizerEmails().has(user.email);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerifiedAt: user.emailVerifiedAt ?? now,
      ...(shouldBeOrganizer && user.role !== "ORGANIZER" ? { role: "ORGANIZER" as const } : {}),
    },
  });

  const session = await createSession(user.id);
  return { userId: user.id, isNewAccount: !user.emailVerifiedAt, ...session };
}
