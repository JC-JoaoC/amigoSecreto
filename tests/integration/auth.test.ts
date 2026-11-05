import { beforeEach, describe, expect, it, vi } from "vitest";

type Sent = { to: string; meta?: Record<string, string> };
const sent: Sent[] = [];
let failNextMail = false;
vi.mock("@/server/mail/mailer", () => ({
  sendMail: vi.fn(async (m: Sent) => {
    if (failNextMail) {
      failNextMail = false;
      throw new Error("SMTP fora do ar");
    }
    sent.push(m);
  }),
}));

import { prisma } from "@/server/db";
import {
  changePassword,
  confirmEmail,
  loginWithPassword,
  registerUser,
  requestPasswordReset,
  resetPassword,
} from "@/server/services/auth";
import { SESSION_TTL_MS, createSession, invalidateSession, validateSessionToken } from "@/server/auth/session";
import { sha256 } from "@/server/crypto";
import { createUser, resetDb } from "../helpers/db";

const PW = "senha-boa-123";
let ipSeq = 0;
const freshIp = () => `10.0.0.${++ipSeq}`;

/** Token do último link enviado para o e-mail (nova senha ou confirmação). */
function lastToken(email: string, kind: "password-reset" | "verify-email") {
  const m = [...sent].reverse().find((x) => x.to === email && x.meta?.kind === kind);
  if (!m?.meta?.url) throw new Error(`nenhum e-mail ${kind} para ${email}`);
  return new URL(m.meta.url).searchParams.get("token")!;
}

beforeEach(async () => {
  await resetDb();
  sent.length = 0;
  failNextMail = false;
});

describe("cadastro com senha", () => {
  it("cria a conta já logada, guarda só o hash e envia link de confirmação", async () => {
    const r = await registerUser({ name: "Ana Souza", email: "  ANA@Teste.dev ", password: PW }, freshIp());
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "ana@teste.dev" } });
    expect(user.name).toBe("Ana Souza");
    expect(user.passwordHash).toMatch(/^scrypt\$/);
    expect(user.passwordHash).not.toContain(PW);
    expect(user.emailVerifiedAt).toBeNull();
    expect((await validateSessionToken(r.token))?.user.id).toBe(user.id);
    expect(lastToken("ana@teste.dev", "verify-email")).toBeTruthy();
  });

  it("recusa e-mail inválido, nome vazio e senha fraca", async () => {
    await expect(registerUser({ name: "Ana", email: "ana@", password: PW }, freshIp())).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(registerUser({ name: "  ", email: "ana@teste.dev", password: PW }, freshIp())).rejects.toMatchObject({
      code: "VALIDATION",
      fieldErrors: { name: expect.any(Array) },
    });
    await expect(registerUser({ name: "Ana", email: "ana@teste.dev", password: "12345678" }, freshIp())).rejects.toMatchObject({
      code: "VALIDATION",
      fieldErrors: { password: expect.any(Array) },
    });
    expect(await prisma.user.count()).toBe(0);
  });

  it("recusa e-mail duplicado (mesmo com maiúsculas diferentes)", async () => {
    await createUser({ email: "ana@teste.dev", password: PW });
    await expect(registerUser({ name: "Outra Ana", email: "ANA@teste.DEV", password: PW }, freshIp())).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(await prisma.user.count()).toBe(1);
  });

  it("se o e-mail de confirmação falhar, a conta é criada mesmo assim", async () => {
    failNextMail = true;
    const r = await registerUser({ name: "Bia Lima", email: "bia@teste.dev", password: PW }, freshIp());
    expect(await validateSessionToken(r.token)).not.toBeNull();
  });
});

describe("login com senha", () => {
  it("senha certa cria sessão; o token não é salvo em texto", async () => {
    await createUser({ email: "caio@teste.dev", password: PW });
    const r = await loginWithPassword({ email: "Caio@Teste.dev", password: PW }, freshIp());
    expect((await validateSessionToken(r.token))?.user.email).toBe("caio@teste.dev");
    expect(await prisma.session.findUnique({ where: { id: r.token } })).toBeNull();
    expect(await prisma.session.findUnique({ where: { id: sha256(r.token) } })).not.toBeNull();
  });

  it("senha errada, e-mail inexistente e conta sem senha dão a mesma resposta", async () => {
    await createUser({ email: "duda@teste.dev", password: PW });
    await createUser({ email: "antiga@teste.dev" }); // conta antiga, sem senha
    for (const [email, password] of [
      ["duda@teste.dev", "senha-errada-1"],
      ["ninguem@teste.dev", PW],
      ["antiga@teste.dev", PW],
    ]) {
      await expect(loginWithPassword({ email, password }, freshIp())).rejects.toMatchObject({
        code: "INVALID_CREDENTIALS",
        userMessage: "E-mail ou senha incorretos.",
      });
    }
  });

  it("limita tentativas por e-mail, mesmo trocando de IP", async () => {
    await createUser({ email: "eva@teste.dev", password: PW });
    for (let i = 0; i < 10; i++) {
      await expect(loginWithPassword({ email: "eva@teste.dev", password: "errada-xyz" }, freshIp())).rejects.toMatchObject({
        code: "INVALID_CREDENTIALS",
      });
    }
    await expect(loginWithPassword({ email: "eva@teste.dev", password: PW }, freshIp())).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
  });
});

describe("esqueci minha senha", () => {
  it("envia link só se a conta existe, mas responde igual nos dois casos", async () => {
    await createUser({ email: "fabi@teste.dev", password: PW });
    await expect(requestPasswordReset({ email: "fabi@teste.dev" }, freshIp())).resolves.toEqual({ email: "fabi@teste.dev" });
    await expect(requestPasswordReset({ email: "nao-existe@teste.dev" }, freshIp())).resolves.toEqual({
      email: "nao-existe@teste.dev",
    });
    expect(sent.map((m) => m.to)).toEqual(["fabi@teste.dev"]);
  });

  it("o link troca a senha, entra na conta, encerra sessões antigas e só funciona uma vez", async () => {
    const u = await createUser({ email: "gabi@teste.dev", password: PW });
    const old = await createSession(u.id);
    await requestPasswordReset({ email: "gabi@teste.dev" }, freshIp());
    const token = lastToken("gabi@teste.dev", "password-reset");

    const r = await resetPassword({ token, password: "nova-senha-456" });
    expect((await validateSessionToken(r.token))?.user.id).toBe(u.id);
    expect(await validateSessionToken(old.token)).toBeNull();

    await expect(loginWithPassword({ email: "gabi@teste.dev", password: PW }, freshIp())).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
    await expect(loginWithPassword({ email: "gabi@teste.dev", password: "nova-senha-456" }, freshIp())).resolves.toBeTruthy();
    await expect(resetPassword({ token, password: "outra-senha-789" })).rejects.toMatchObject({ code: "TOKEN_INVALID" });
    // O link chegou no e-mail: o endereço fica confirmado.
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).emailVerifiedAt).not.toBeNull();
  });

  it("link expirado ou inventado não funciona", async () => {
    await createUser({ email: "hugo@teste.dev", password: PW });
    await requestPasswordReset({ email: "hugo@teste.dev" }, freshIp());
    const token = lastToken("hugo@teste.dev", "password-reset");
    await prisma.authToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(resetPassword({ token, password: "nova-senha-456" })).rejects.toMatchObject({ code: "TOKEN_INVALID" });
    await expect(resetPassword({ token: "x".repeat(43), password: "nova-senha-456" })).rejects.toMatchObject({
      code: "TOKEN_INVALID",
    });
  });

  it("pedir um link novo invalida o anterior", async () => {
    await createUser({ email: "iris@teste.dev", password: PW });
    await requestPasswordReset({ email: "iris@teste.dev" }, freshIp());
    const first = lastToken("iris@teste.dev", "password-reset");
    await requestPasswordReset({ email: "iris@teste.dev" }, freshIp());
    await expect(resetPassword({ token: first, password: "nova-senha-456" })).rejects.toMatchObject({ code: "TOKEN_INVALID" });
  });

  it("limita pedidos de link por e-mail", async () => {
    await createUser({ email: "joao@teste.dev", password: PW });
    for (let i = 0; i < 3; i++) await requestPasswordReset({ email: "joao@teste.dev" }, freshIp());
    await expect(requestPasswordReset({ email: "joao@teste.dev" }, freshIp())).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });
});

describe("confirmação de e-mail e organizador", () => {
  it("e-mail de ORGANIZER_EMAILS só vira organizador depois de confirmar o e-mail", async () => {
    await registerUser({ name: "Organizadora", email: "organizadora@teste.dev", password: PW }, freshIp());
    await loginWithPassword({ email: "organizadora@teste.dev", password: PW }, freshIp());
    expect((await prisma.user.findUniqueOrThrow({ where: { email: "organizadora@teste.dev" } })).role).toBe("USER");

    const r = await confirmEmail({ token: lastToken("organizadora@teste.dev", "verify-email") });
    expect(r.isOrganizer).toBe(true);
    const u = await prisma.user.findUniqueOrThrow({ where: { email: "organizadora@teste.dev" } });
    expect(u.role).toBe("ORGANIZER");
    expect(u.emailVerifiedAt).not.toBeNull();
  });

  it("sessão já aberta vira organizadora sem sair e entrar (e-mail confirmado + na lista)", async () => {
    const u = await createUser({ email: "organizadora@teste.dev", verified: true });
    const { token } = await createSession(u.id);
    expect((await validateSessionToken(token))?.user.role).toBe("ORGANIZER");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).role).toBe("ORGANIZER");
  });

  it("sessão aberta com e-mail da lista mas sem confirmação continua participante", async () => {
    const u = await createUser({ email: "organizadora@teste.dev", verified: false });
    const { token } = await createSession(u.id);
    expect((await validateSessionToken(token))?.user.role).toBe("USER");
  });

  it("link de confirmação não serve para trocar senha (e vice-versa) e só vale uma vez", async () => {
    await registerUser({ name: "Kika Reis", email: "kika@teste.dev", password: PW }, freshIp());
    const verify = lastToken("kika@teste.dev", "verify-email");
    await expect(resetPassword({ token: verify, password: "nova-senha-456" })).rejects.toMatchObject({ code: "TOKEN_INVALID" });
    await expect(confirmEmail({ token: verify })).resolves.toMatchObject({ isOrganizer: false });
    await expect(confirmEmail({ token: verify })).rejects.toMatchObject({ code: "TOKEN_INVALID" });
  });
});

describe("troca de senha logado", () => {
  it("exige a senha atual e encerra as outras sessões, mantendo a atual", async () => {
    const u = await createUser({ email: "lia@teste.dev", password: PW });
    const atual = await createSession(u.id);
    const outra = await createSession(u.id);

    await expect(changePassword(u.id, atual.token, { current: "errada-123", password: "nova-senha-456" })).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
    await changePassword(u.id, atual.token, { current: PW, password: "nova-senha-456" });
    expect(await validateSessionToken(atual.token)).not.toBeNull();
    expect(await validateSessionToken(outra.token)).toBeNull();
    await expect(loginWithPassword({ email: "lia@teste.dev", password: "nova-senha-456" }, freshIp())).resolves.toBeTruthy();
  });
});

describe("sessão", () => {
  it("sessão expirada é recusada e removida", async () => {
    const u = await createUser();
    const { token } = await createSession(u.id);
    await prisma.session.update({ where: { id: sha256(token) }, data: { expiresAt: new Date(Date.now() - 1) } });
    expect(await validateSessionToken(token)).toBeNull();
    expect(await prisma.session.count()).toBe(0);
  });

  it("token falsificado ou vazio não autentica", async () => {
    expect(await validateSessionToken("token-inventado")).toBeNull();
    expect(await validateSessionToken("")).toBeNull();
    expect(await validateSessionToken(undefined)).toBeNull();
  });

  it("sessão perto de expirar é renovada (sliding)", async () => {
    const u = await createUser();
    const { token } = await createSession(u.id);
    await prisma.session.update({ where: { id: sha256(token) }, data: { expiresAt: new Date(Date.now() + 24 * 3600 * 1000) } });
    const r = await validateSessionToken(token);
    expect(r!.expiresAt.getTime()).toBeGreaterThan(Date.now() + SESSION_TTL_MS - 60_000);
  });

  it("logout invalida a sessão", async () => {
    const u = await createUser();
    const { token } = await createSession(u.id);
    await invalidateSession(token);
    expect(await validateSessionToken(token)).toBeNull();
  });
});
