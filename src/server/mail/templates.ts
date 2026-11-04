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

function button(url: string, label: string): string {
  return `<p style="text-align:center;margin:0 0 20px"><a href="${escapeHtml(url)}" style="display:inline-block;background:#b8232f;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 26px;border-radius:8px">${escapeHtml(label)}</a></p>`;
}

function fallbackLink(url: string): string {
  return `<p style="margin:0 0 16px;font-size:13px;color:#6b7a72;word-break:break-all">Se o botão não funcionar, copie e cole no navegador:<br>${escapeHtml(url)}</p>`;
}

export function passwordResetEmail(params: { to: string; name: string; url: string; minutes: number }): MailMessage {
  const { to, name, url, minutes } = params;
  const hello = firstName(name);
  const subject = `Crie uma nova senha no ${BRAND.name}`;
  const text = [
    `Olá, ${hello}!`,
    "",
    "Recebemos um pedido para criar uma nova senha na sua conta.",
    `Abra o link abaixo (vale por ${minutes} minutos e só funciona uma vez):`,
    url,
    "",
    "Se não foi você, ignore este e-mail. Sua senha atual continua valendo.",
  ].join("\n");
  const html = layout(
    subject,
    `<p style="margin:0 0 12px;font-size:16px">Olá, <strong>${escapeHtml(hello)}</strong>!</p>
     <p style="margin:0 0 20px;font-size:15px;line-height:1.5">Recebemos um pedido para criar uma nova senha na sua conta. O link vale por <strong>${minutes} minutos</strong> e só funciona uma vez.</p>
     ${button(url, "Criar nova senha")}
     ${fallbackLink(url)}
     <p style="margin:0;font-size:13px;color:#6b7a72">Se não foi você, ignore este e-mail. Sua senha atual continua valendo.</p>`,
  );
  return { to, subject, text, html, meta: { kind: "password-reset", url } };
}

export function verifyEmailEmail(params: { to: string; name: string; url: string }): MailMessage {
  const { to, name, url } = params;
  const hello = firstName(name);
  const subject = `Confirme seu e-mail no ${BRAND.name}`;
  const text = [
    `Olá, ${hello}!`,
    "",
    "Sua conta foi criada. Confirme que este e-mail é seu abrindo o link abaixo:",
    url,
    "",
    "Se não foi você quem criou a conta, ignore este e-mail.",
  ].join("\n");
  const html = layout(
    subject,
    `<p style="margin:0 0 12px;font-size:16px">Olá, <strong>${escapeHtml(hello)}</strong>!</p>
     <p style="margin:0 0 20px;font-size:15px;line-height:1.5">Sua conta foi criada. Confirme que este e-mail é seu. Leva um clique.</p>
     ${button(url, "Confirmar meu e-mail")}
     ${fallbackLink(url)}
     <p style="margin:0;font-size:13px;color:#6b7a72">Se não foi você quem criou a conta, ignore este e-mail.</p>`,
  );
  return { to, subject, text, html, meta: { kind: "verify-email", url } };
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
     <p style="text-align:center;margin:0 0 20px"><a href="${escapeHtml(url)}" style="display:inline-block;background:#b8232f;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 26px;border-radius:8px">Descobrir quem eu tirei</a></p>
     <p style="margin:0;font-size:13px;color:#6b7a72">Por segurança, o nome não vai neste e-mail. Ele só aparece depois que você entra.</p>`,
  );
  return { to, subject, text, html, meta: { kind: "draw-completed", drawId } };
}
