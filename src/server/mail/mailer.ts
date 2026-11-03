import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../env";

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Metadados úteis para testes automatizados (ex.: o código). Nunca logados em produção. */
  meta?: Record<string, string>;
};

let smtp: Transporter | null = null;

function smtpTransport(): Transporter {
  if (smtp) return smtp;
  const e = env();
  smtp = nodemailer.createTransport({
    host: e.SMTP_HOST,
    port: e.SMTP_PORT,
    secure: e.SMTP_SECURE,
    auth: e.SMTP_USER ? { user: e.SMTP_USER, pass: e.SMTP_PASSWORD } : undefined,
  });
  return smtp;
}

/**
 * Transporte "console": só para desenvolvimento/teste. Mostra o e-mail no terminal
 * e, se MAIL_OUTBOX_DIR estiver definido, grava um .json (usado pelos testes E2E).
 */
async function consoleTransport(message: MailMessage) {
  const e = env();
  if (e.NODE_ENV === "production") {
    throw new Error("MAIL_TRANSPORT=console não é permitido em produção. Configure SMTP.");
  }
  console.info(
    `\n [e-mail de desenvolvimento] para: ${message.to}\n   assunto: ${message.subject}\n${message.text
      .split("\n")
      .map((l) => `   ${l}`)
      .join("\n")}\n`,
  );
  if (e.MAIL_OUTBOX_DIR) {
    const dir = path.resolve(/*turbopackIgnore: true*/ process.cwd(), e.MAIL_OUTBOX_DIR);
    await mkdir(dir, { recursive: true });
    const safeTo = message.to.replace(/[^a-z0-9@._-]/gi, "_");
    const file = path.join(/*turbopackIgnore: true*/ dir, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeTo}.json`);
    await writeFile(file, JSON.stringify({ ...message, sentAt: new Date().toISOString() }, null, 2));
  }
}

export async function sendMail(message: MailMessage): Promise<void> {
  const e = env();
  if (e.MAIL_TRANSPORT === "console") {
    await consoleTransport(message);
    return;
  }
  await smtpTransport().sendMail({
    from: e.MAIL_FROM,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
}
