import { createHash, randomBytes } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import type { BrowserContext } from "@playwright/test";
import { Pool } from "pg";

const DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://laco:laco_dev_password@localhost:5434/laco_test?schema=public";
const OUTBOX = path.resolve(process.cwd(), ".mail-outbox/e2e");

export const pool = new Pool({ connectionString: DATABASE_URL, max: 2 });

export const uid = () => `e2e${randomBytes(8).toString("hex")}`;
export const runTag = () => randomBytes(3).toString("hex");

/** Lê o último código de login enviado para o e-mail (caixa de saída de teste). */
export async function readLoginCode(email: string, since = 0): Promise<string> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const files = (await readdir(OUTBOX).catch(() => [] as string[])).sort().reverse();
    for (const f of files) {
      const ts = Number(f.split("-")[0]);
      if (ts < since) continue;
      const msg = JSON.parse(await readFile(path.join(OUTBOX, f), "utf8"));
      if (msg.to === email && msg.meta?.kind === "login-code") return msg.meta.code as string;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Nenhum código encontrado para ${email}`);
}

export async function seedUser(name: string, email: string, role: "USER" | "ORGANIZER" = "USER") {
  const id = uid();
  const search = name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  await pool.query(
    `INSERT INTO users (id, name, search_name, email, role, email_verified_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, now(), now(), now())`,
    [id, name, search, email, role],
  );
  return { id, name, email };
}

export async function seedGift(userId: string, title: string, url: string) {
  await pool.query(
    `INSERT INTO gifts (id, user_id, title, url, created_at, updated_at) VALUES ($1, $2, $3, $4, now(), now())`,
    [uid(), userId, title, url],
  );
}

/** Cria uma sessão válida direto no banco e injeta o cookie (atalho para cenários multiusuário). */
export async function loginAs(context: BrowserContext, userId: string, baseURL: string) {
  const token = randomBytes(32).toString("base64url");
  const id = createHash("sha256").update(token).digest("hex");
  await pool.query(`INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES ($1, $2, now() + interval '1 day', now())`, [
    id,
    userId,
  ]);
  await context.addCookies([{ name: "laco_session", value: token, url: baseURL, httpOnly: true, sameSite: "Lax" }]);
}
