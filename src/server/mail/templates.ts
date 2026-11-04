import "server-only";
import { BRAND } from "@/lib/brand";
import { firstName } from "@/lib/text";
import { env } from "../env";
import type { MailMessage } from "./mailer";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;background:#f3f5f2;font-family:Arial,Helvetica,sans-serif;color:#1d2b24">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(16,46,34,.08)">
        <tr><td style="background:#0f2a1f;padding:22px 28px;color:#ffffff;font-size:20px;font-weight:bold">
          ${escapeHtml(BRAND.name)} <span style="color:#e8d38a;font-weight:normal;font-size:14px">· amigo secreto</span>
        </td></tr>
        <tr><td style="padding:28px">${body}</td></tr>
        <tr><td style="padding:16px 28px 24px;color:#6b7a72;font-size:12px;line-height:1.5">
          Você recebeu este e-mail porque tem uma conta no ${escapeHtml(BRAND.name)}. Se não foi você, pode ignorar com segurança.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export function loginCodeEmail(params: { to: string; name: string; code: string; minutes: number }): MailMessage {
  const { to, name, code, minutes } = params;
  const hello = firstName(name);
  const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
  const subject = `${spaced} é seu código de acesso ao ${BRAND.name}`;
  const text = [
    `Olá, ${hello}!`,
    "",
    `Seu código de acesso é: ${spaced}`,
    "",
    `Ele vale por ${minutes} minutos e só pode ser usado uma vez.`,
    "Não compartilhe este código com ninguém.",
  ].join("\n");
  const html = layout(
    subject,
    `<p style="margin:0 0 12px;font-size:16px">Olá, <strong>${escapeHtml(hello)}</strong>!</p>
     <p style="margin:0 0 20px;font-size:15px;line-height:1.5">Use o código abaixo para entrar. Ele vale por <strong>${minutes} minutos</strong> e só pode ser usado uma vez.</p>
     <div style="text-align:center;margin:0 0 20px">
       <span style="display:inline-block;background:#f1f7f3;border:2px dashed #2a7a57;border-radius:14px;padding:14px 22px;font-size:32px;letter-spacing:8px;font-weight:bold;color:#0f2a1f;font-family:'Courier New',monospace">${escapeHtml(spaced)}</span>
     </div>
     <p style="margin:0;font-size:13px;color:#6b7a72">Não compartilhe este código com ninguém, nem com quem disser ser do ${escapeHtml(BRAND.name)}.</p>`,
  );
  return { to, subject, text, html, meta: { kind: "login-code", code } };
}

export function drawCompletedEmail(params: { to: string; name: string; drawName: string; drawId: string }): MailMessage {
  const { to, name, drawName, drawId } = params;
  const url = `${env().APP_URL.replace(/\/$/, "")}/meu-resultado?sorteio=${encodeURIComponent(drawId)}`;
  const subject = `O sorteio "${drawName}" foi realizado!`;
  const text = [
    `Olá, ${firstName(name)}!`,
    "",
    `O sorteio "${drawName}" acabou de acontecer.`,
    `Entre para descobrir quem você tirou: ${url}`,
    "",
    "Lembre-se: é segredo!",
  ].join("\n");
  const html = layout(
    subject,
    `<p style="margin:0 0 12px;font-size:16px">Olá, <strong>${escapeHtml(firstName(name))}</strong>!</p>
     <p style="margin:0 0 20px;font-size:15px;line-height:1.5">O sorteio <strong>${escapeHtml(drawName)}</strong> acabou de acontecer. Seu amigo secreto já está esperando por você.</p>
     <p style="text-align:center;margin:0 0 20px"><a href="${escapeHtml(url)}" style="display:inline-block;background:#b8232f;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 26px;border-radius:999px">Descobrir quem eu tirei</a></p>
     <p style="margin:0;font-size:13px;color:#6b7a72">Por segurança, o nome não vai neste e-mail. Ele só aparece depois que você entra.</p>`,
  );
  return { to, subject, text, html, meta: { kind: "draw-completed", drawId } };
}
