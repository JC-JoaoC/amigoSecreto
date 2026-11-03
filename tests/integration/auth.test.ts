import { beforeEach, describe, expect, it, vi } from "vitest";

const sent: { to: string; meta?: Record<string, string> }[] = [];
vi.mock("@/server/mail/mailer", () => ({
  sendMail: vi.fn(async (m: { to: string; meta?: Record<string, string> }) => {
    sent.push(m);
  }),
}));

import { prisma } from "@/server/db";
import { registerUser, requestLoginCode, verifyLoginCode, LOGIN_CODE_MAX_ATTEMPTS } from "@/server/services/auth";
import { SESSION_TTL_MS, createSession, invalidateSession, validateSessionToken } from "@/server/auth/session";
import { sha256 } from "@/server/crypto";
import { createUser, resetDb } from "../helpers/db";

const lastCodeFor = (email: string) => [...sent].reverse().find((m) => m.to === email)?.meta?.code as string;

let ipSeq = 0;
const freshIp = () => `10.0.0.${++ipSeq}`;

beforeEach(async () => {
  await resetDb();
  sent.length = 0;
});

describe("cadastro", () => {
  it("cadastro válido cria conta não verificada e envia código", async () => {
    const r = await registerUser({ name: "Ana Souza", email: "  ANA@Teste.dev " }, freshIp());
    expect(r.email).toBe("ana@teste.dev");
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "ana@teste.dev" } });
    expect(user.name).toBe("Ana Souza");
    expect(user.searchName).toBe("ana souza");
    expect(user.emailVerifiedAt).toBeNull();
    expect(lastCodeFor("ana@teste.dev")).toMatch(/^\d{6}$/);
    // O código nunca é gravado em texto puro.
    const code = await prisma.loginCode.findFirstOrThrow({ where: { userId: user.id } });
    expect(code.codeHash).not.toContain(lastCodeFor("ana@teste.dev"));
  });

  it("recusa e-mail inválido", async () => {
    await expect(registerUser({ name: "Ana", email: "ana@" }, freshIp())).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("recusa nome vazio", async () => {
    await expect(registerUser({ name: "  ", email: "ana@teste.dev" }, freshIp())).rejects.toMatchObject({
      code: "VALIDATION",
      fieldErrors: { name: expect.any(Array) },
    });
  });

  it("recusa e-mail duplicado (mesmo com maiúsculas diferentes)", async () => {
    await createUser({ email: "ana@teste.dev" });
    await expect(registerUser({ name: "Outra Ana", email: "ANA@teste.DEV" }, freshIp())).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(await prisma.user.count()).toBe(1);
  });

  it("conta não verificada pode ser cadastrada de novo (não trava o e-mail de ninguém)", async () => {
    await registerUser({ name: "Nome Errado", email: "ana@teste.dev" }, freshIp());
    await registerUser({ name: "Ana Certa", email: "ana@teste.dev" }, freshIp());
    const users = await prisma.user.findMany();
    expect(users).toHaveLength(1);
    expect(users[0].name).toBe("Ana Certa");
  });
});

describe("login por código", () => {
  it("login válido: código correto cria sessão e verifica a conta", async () => {
    await registerUser({ name: "Bia Lima", email: "bia@teste.dev" }, freshIp());
    const result = await verifyLoginCode({ email: "bia@teste.dev", code: lastCodeFor("bia@teste.dev") }, freshIp());
    expect(result.isNewAccount).toBe(true);
    const session = await validateSessionToken(result.token);
    expect(session?.user.email).toBe("bia@teste.dev");
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "bia@teste.dev" } });
    expect(user.emailVerifiedAt).not.toBeNull();
    // Token não é salvo em texto puro.
    expect(await prisma.session.findUnique({ where: { id: result.token } })).toBeNull();
    expect(await prisma.session.findUnique({ where: { id: sha256(result.token) } })).not.toBeNull();
  });

  it("usuário não cadastrado recebe not_found e nenhum e-mail", async () => {
    const r = await requestLoginCode({ email: "ninguem@teste.dev" }, freshIp());
    expect(r.status).toBe("not_found");
    expect(sent).toHaveLength(0);
  });

  it("código incorreto é recusado e informa tentativas restantes", async () => {
    await createUser({ email: "caio@teste.dev" });
    await requestLoginCode({ email: "caio@teste.dev" }, freshIp());
    const right = lastCodeFor("caio@teste.dev");
    const wrong = right === "000000" ? "111111" : "000000";
    await expect(verifyLoginCode({ email: "caio@teste.dev", code: wrong }, freshIp())).rejects.toMatchObject({
      code: "CODE_INVALID",
      userMessage: expect.stringContaining(`${LOGIN_CODE_MAX_ATTEMPTS - 1} tentativas`),
    });
  });

  it("código expirado é recusado", async () => {
    const u = await createUser({ email: "duda@teste.dev" });
    await requestLoginCode({ email: "duda@teste.dev" }, freshIp());
    await prisma.loginCode.updateMany({ where: { userId: u.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(
      verifyLoginCode({ email: "duda@teste.dev", code: lastCodeFor("duda@teste.dev") }, freshIp()),
    ).rejects.toMatchObject({ code: "CODE_EXPIRED" });
  });

  it("código é de uso único", async () => {
    await createUser({ email: "eva@teste.dev" });
    await requestLoginCode({ email: "eva@teste.dev" }, freshIp());
    const code = lastCodeFor("eva@teste.dev");
    await verifyLoginCode({ email: "eva@teste.dev", code }, freshIp());
    await expect(verifyLoginCode({ email: "eva@teste.dev", code }, freshIp())).rejects.toMatchObject({
      code: "CODE_EXPIRED",
    });
  });

  it("pedir novo código invalida o anterior", async () => {
    await createUser({ email: "fabi@teste.dev" });
    await requestLoginCode({ email: "fabi@teste.dev" }, freshIp());
    const first = lastCodeFor("fabi@teste.dev");
    await requestLoginCode({ email: "fabi@teste.dev" }, freshIp());
    const second = lastCodeFor("fabi@teste.dev");
    if (first !== second) {
      await expect(verifyLoginCode({ email: "fabi@teste.dev", code: first }, freshIp())).rejects.toBeTruthy();
    }
    await expect(verifyLoginCode({ email: "fabi@teste.dev", code: second }, freshIp())).resolves.toBeTruthy();
  });

  it("tentativas excessivas bloqueiam o código, mesmo acertando depois", async () => {
    await createUser({ email: "gabi@teste.dev" });
    await requestLoginCode({ email: "gabi@teste.dev" }, freshIp());
    const right = lastCodeFor("gabi@teste.dev");
    const wrong = right === "000000" ? "111111" : "000000";
    for (let i = 0; i < LOGIN_CODE_MAX_ATTEMPTS - 1; i++) {
      await expect(verifyLoginCode({ email: "gabi@teste.dev", code: wrong }, freshIp())).rejects.toMatchObject({
        code: "CODE_INVALID",
      });
    }
    await expect(verifyLoginCode({ email: "gabi@teste.dev", code: wrong }, freshIp())).rejects.toMatchObject({
      code: "CODE_LOCKED",
    });
    await expect(verifyLoginCode({ email: "gabi@teste.dev", code: right }, freshIp())).rejects.toBeTruthy();
  });

  it("rate limit: muitos pedidos de código para o mesmo e-mail são bloqueados", async () => {
    await createUser({ email: "hugo@teste.dev" });
    for (let i = 0; i < 5; i++) await requestLoginCode({ email: "hugo@teste.dev" }, freshIp());
    await expect(requestLoginCode({ email: "hugo@teste.dev" }, freshIp())).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
  });

  it("rate limit: cadastros repetidos para o mesmo e-mail (de IPs diferentes) são bloqueados", async () => {
    for (let i = 0; i < 5; i++) await registerUser({ name: "Vítima Alvo", email: "alvo@teste.dev" }, freshIp());
    await expect(registerUser({ name: "Vítima Alvo", email: "alvo@teste.dev" }, freshIp())).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
    expect(sent.filter((m) => m.to === "alvo@teste.dev")).toHaveLength(5);
  });

  it("rate limit: muitas verificações do mesmo IP são bloqueadas", async () => {
    await createUser({ email: "iris@teste.dev" });
    const ip = freshIp();
    let limited = false;
    for (let i = 0; i < 40 && !limited; i++) {
      try {
        await verifyLoginCode({ email: "iris@teste.dev", code: "123456" }, ip);
      } catch (e) {
        if ((e as { code?: string }).code === "RATE_LIMITED") limited = true;
      }
    }
    expect(limited).toBe(true);
  });

  it("e-mail listado em ORGANIZER_EMAILS vira organizador ao entrar", async () => {
    await registerUser({ name: "Organizadora", email: "organizadora@teste.dev" }, freshIp());
    await verifyLoginCode({ email: "organizadora@teste.dev", code: lastCodeFor("organizadora@teste.dev") }, freshIp());
    const u = await prisma.user.findUniqueOrThrow({ where: { email: "organizadora@teste.dev" } });
    expect(u.role).toBe("ORGANIZER");
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
    await prisma.session.update({
      where: { id: sha256(token) },
      data: { expiresAt: new Date(Date.now() + 24 * 3600 * 1000) },
    });
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
