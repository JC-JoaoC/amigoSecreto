/**
 * Regras de validação compartilhadas: o cliente usa para feedback imediato,
 * o servidor usa como fonte de verdade (nunca confiamos só no frontend).
 */
import { z } from "zod";
import { cleanName, normalizeEmail } from "./text";

export const LIMITS = {
  nameMin: 2,
  nameMax: 80,
  emailMax: 254,
  passwordMax: 128,
  giftTitleMax: 120,
  giftUrlMax: 2048,
  giftDescriptionMax: 500,
  giftsPerUser: 50,
  drawNameMax: 80,
  drawDescriptionMax: 500,
  drawBudgetMax: 40,
} as const;

// Letras (com acentos), espaços, apóstrofo, hífen e ponto. Bloqueia <, >, números etc.
const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}' .-]*$/u;

export const nameSchema = z
  .string({ error: "Informe seu nome." })
  .transform(cleanName)
  .pipe(
    z
      .string()
      .min(LIMITS.nameMin, { error: "Informe seu nome completo." })
      .max(LIMITS.nameMax, { error: `Use no máximo ${LIMITS.nameMax} caracteres.` })
      .regex(NAME_PATTERN, { error: "Use apenas letras, espaços, hífen ou apóstrofo." }),
  );

export const emailSchema = z
  .string({ error: "Informe seu e-mail." })
  .transform(normalizeEmail)
  .pipe(
    z
      .string()
      .min(1, { error: "Informe seu e-mail." })
      .max(LIMITS.emailMax, { error: "E-mail muito longo." })
      .pipe(z.email({ error: "Digite um e-mail válido, como nome@exemplo.com." })),
  );

// Senhas fracas demais para aceitar (lista curta das mais usadas no Brasil).
const COMMON_PASSWORDS = new Set([
  "12345678", "123456789", "1234567890", "12341234", "87654321", "11111111", "00000000",
  "password", "password1", "senha123", "senha1234", "senhasenha", "qwerty123", "qwertyuiop",
  "abcdefgh", "abc12345", "iloveyou", "brasil123", "amigosecreto", "amigo123", "mudar123",
]);

/** Senha nova: mínimo 8 caracteres. Não é aparada (espaços contam). */
export const passwordSchema = z
  .string({ error: "Crie uma senha." })
  .min(8, { error: "Use pelo menos 8 caracteres." })
  .max(LIMITS.passwordMax, { error: `Use no máximo ${LIMITS.passwordMax} caracteres.` })
  .refine((v) => !COMMON_PASSWORDS.has(v.toLowerCase()), { error: "Essa senha é muito comum. Escolha outra." })
  .refine((v) => !/^(.)\1+$/.test(v), { error: "Evite repetir o mesmo caractere." });

/** Senha digitada no login: só exige que exista (a regra de força vale ao criar). */
const typedPasswordSchema = z
  .string({ error: "Digite sua senha." })
  .min(1, { error: "Digite sua senha." })
  .max(LIMITS.passwordMax, { error: "Senha inválida." });

/** Só aceita http/https, sem usuário/senha embutidos e com domínio válido. */
export function parseSafeUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  const host = url.hostname;
  if (!host || (!host.includes(".") && host !== "localhost")) return null;
  return url;
}

export const giftUrlSchema = z
  .string({ error: "Informe o link do produto." })
  .trim()
  .min(1, { error: "Informe o link do produto." })
  .max(LIMITS.giftUrlMax, { error: "Link muito longo." })
  .transform((value, ctx) => {
    // Aceita "loja.com.br/produto" adicionando https:// automaticamente.
    const candidate = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
    const url = parseSafeUrl(candidate);
    if (!url) {
      ctx.addIssue({ code: "custom", message: "Use um link válido começando com https://" });
      return z.NEVER;
    }
    return url.toString();
  });

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, { error: `${label}: use no máximo ${max} caracteres.` })
    .optional()
    .transform((v) => (v ? v : null));

export const giftInputSchema = z.object({
  title: z
    .string({ error: "Dê um nome ao presente." })
    .trim()
    .min(2, { error: "Dê um nome ao presente." })
    .max(LIMITS.giftTitleMax, { error: `Use no máximo ${LIMITS.giftTitleMax} caracteres.` }),
  url: giftUrlSchema,
  description: optionalText(LIMITS.giftDescriptionMax, "Descrição"),
});
export type GiftInput = z.input<typeof giftInputSchema>;

export const registerSchema = z.object({ name: nameSchema, email: emailSchema, password: passwordSchema });
export const loginSchema = z.object({ email: emailSchema, password: typedPasswordSchema });
export const forgotPasswordSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({
  token: z.string({ error: "Link inválido." }).min(20, { error: "Link inválido." }).max(200, { error: "Link inválido." }),
  password: passwordSchema,
});
export const changePasswordSchema = z.object({ current: typedPasswordSchema, password: passwordSchema });

const dateOnly = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      ctx.addIssue({ code: "custom", message: "Data inválida." });
      return z.NEVER;
    }
    const date = new Date(`${v}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) {
      ctx.addIssue({ code: "custom", message: "Data inválida." });
      return z.NEVER;
    }
    return date;
  });

export const drawInputSchema = z.object({
  name: z
    .string({ error: "Dê um nome ao sorteio." })
    .trim()
    .min(3, { error: "Dê um nome ao sorteio (mínimo 3 letras)." })
    .max(LIMITS.drawNameMax, { error: `Use no máximo ${LIMITS.drawNameMax} caracteres.` }),
  description: optionalText(LIMITS.drawDescriptionMax, "Descrição"),
  budget: optionalText(LIMITS.drawBudgetMax, "Valor sugerido"),
  eventDate: dateOnly,
});
export type DrawInput = z.input<typeof drawInputSchema>;

/** Sorteio do saco: só nome e recado. */
export const bagDrawInputSchema = drawInputSchema.pick({ name: true, description: true });
export type BagDrawInput = z.input<typeof bagDrawInputSchema>;

export const idSchema = z.string().trim().min(1).max(64).regex(/^[a-z0-9]+$/i);

/** Converte erros do zod em { campo: [mensagens] } para os formulários. */
export function fieldErrorsOf(error: z.ZodError): Record<string, string[]> {
  return z.flattenError(error).fieldErrors as Record<string, string[]>;
}
