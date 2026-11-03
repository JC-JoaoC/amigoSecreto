import type { z } from "zod";
import { fieldErrorsOf } from "@/lib/validation";
import { AppError } from "./errors";

/** Valida no servidor e converte falhas em AppError com mensagens por campo. */
export function parseOrThrow<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const fieldErrors = fieldErrorsOf(result.error);
    const hasFields = Object.keys(fieldErrors).length > 0;
    const first = Object.values(fieldErrors).flat()[0] ?? result.error.issues[0]?.message ?? "Dados inválidos.";
    throw new AppError("VALIDATION", first, hasFields ? fieldErrors : undefined);
  }
  return result.data;
}
