import "server-only";
import type { ActionResult } from "@/lib/action-result";
import { isAppError } from "./errors";

/**
 * Envolve a lógica de uma Server Action: erros de negócio viram mensagem amigável,
 * qualquer outro erro é logado (sem dados sensíveis) e vira mensagem genérica.
 */
export async function runAction<T>(name: string, fn: () => Promise<T>, message?: string): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data, message };
  } catch (error) {
    if (isAppError(error)) {
      return { ok: false, error: error.userMessage, fieldErrors: error.fieldErrors };
    }
    const err = error as Error;
    console.error(`[action:${name}] erro inesperado: ${err?.name ?? "Error"}: ${err?.message ?? String(error)}`);
    return { ok: false, error: "Algo deu errado do nosso lado. Tente novamente em instantes." };
  }
}
