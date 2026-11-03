import { execSync } from "node:child_process";
import { rm } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";

/** Banco de teste limpo + organizador semeado + caixa de saída vazia. */
export default async function globalSetup() {
  const url =
    process.env.TEST_DATABASE_URL ?? "postgresql://laco:laco_dev_password@localhost:5434/laco_test?schema=public";
  execSync("npx prisma migrate deploy", { stdio: "pipe", env: { ...process.env, DATABASE_URL: url } });

  const pool = new Pool({ connectionString: url });
  await pool.query(
    'TRUNCATE TABLE "draw_messages", "draw_results", "draw_participants", "draws", "gifts", "sessions", "login_codes", "rate_limits", "users" RESTART IDENTITY CASCADE',
  );
  await pool.query(
    `INSERT INTO users (id, name, search_name, email, role, email_verified_at, created_at, updated_at)
     VALUES ('e2eorganizer', 'Olívia Organizadora', 'olivia organizadora', 'organizador-e2e@teste.dev', 'ORGANIZER', now(), now(), now())`,
  );
  await pool.end();

  await rm(path.resolve(process.cwd(), ".mail-outbox/e2e"), { recursive: true, force: true });
}
