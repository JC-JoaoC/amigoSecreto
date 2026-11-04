import "server-only";
import { z } from "zod";

/**
 * Variáveis de ambiente validadas na primeira leitura.
 * Nada aqui é exposto ao navegador (sem prefixo NEXT_PUBLIC_).
 */
const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatória"),
    APP_URL: z.url("APP_URL deve ser uma URL, ex.: https://amigo.seudominio.com.br"),
    APP_SECRET: z.string().min(32, "APP_SECRET precisa de pelo menos 32 caracteres"),
    MAIL_TRANSPORT: z.enum(["smtp", "console"]).default("console"),
    MAIL_FROM: z.string().min(3).default("Laço Amigo Secreto <nao-responda@localhost>"),
    MAIL_OUTBOX_DIR: z.string().optional(),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_SECURE: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    ORGANIZER_EMAILS: z.string().default(""),
  })
  .superRefine((env, ctx) => {
    if (env.MAIL_TRANSPORT === "smtp" && !env.SMTP_HOST) {
      ctx.addIssue({ code: "custom", path: ["SMTP_HOST"], message: "SMTP_HOST é obrigatório com MAIL_TRANSPORT=smtp" });
    }
  });

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Configuração inválida de ambiente: ${details}`);
  }
  cached = parsed.data;
  return cached;
}

export function organizerEmails(): Set<string> {
  return new Set(
    env()
      .ORGANIZER_EMAILS.split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export const isProduction = () => env().NODE_ENV === "production";
