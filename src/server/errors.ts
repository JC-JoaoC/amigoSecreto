/**
 * Erro de regra de negócio com mensagem segura para mostrar ao usuário.
 * Qualquer outro erro vira uma mensagem genérica (sem vazar detalhes internos).
 */
export type AppErrorCode =
  | "VALIDATION"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "CODE_INVALID"
  | "CODE_EXPIRED"
  | "CODE_LOCKED"
  | "EMAIL_FAILED"
  | "DRAW_COMPLETED"
  | "DRAW_NOT_ENOUGH"
  | "DRAW_NOT_READY"
  | "LIMIT_REACHED";

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    public readonly userMessage: string,
    public readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(userMessage);
    this.name = "AppError";
  }
}

export const isAppError = (e: unknown): e is AppError => e instanceof AppError;
