"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { requestCodeAction, verifyCodeAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { codeSchema } from "@/lib/validation";

const RESEND_SECONDS = 30;

/** Etapa 2 do login/cadastro: digitar o código recebido por e-mail. */
export function CodeStep({ email, next, onChangeEmail }: { email: string; next?: string; onChangeEmail: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [resending, startResend] = useTransition();
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function submit(value = code) {
    const parsed = codeSchema.safeParse(value);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Código inválido.");
      inputRef.current?.focus();
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await verifyCodeAction({ email, code: parsed.data, next });
      if (!r.ok) {
        setError(r.error);
        inputRef.current?.select();
        return;
      }
      toast.success(r.data.isNewAccount ? "Conta confirmada. Bem-vindo(a)!" : "Que bom te ver de novo.");
      router.replace(r.data.redirectTo);
      router.refresh();
    });
  }

  function resend() {
    startResend(async () => {
      const r = await requestCodeAction({ email });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setCooldown(RESEND_SECONDS);
      setCode("");
      toast.success("Enviamos um novo código. O anterior deixou de valer.");
    });
  }

  return (
    <div className="animate-rise">
      <div className="mb-6 text-base text-ink">
        {/* O e-mail desce inteiro para a linha seguinte; só quebra por dentro se não couber sozinho. */}
        <p>
          Enviamos um código de 6 dígitos para{" "}
          <strong className="font-medium [overflow-wrap:anywhere]">{email}</strong>.
        </p>
        <p className="mt-1 text-[15px] text-ink-2">Ele vale por 10 minutos. Não chegou? Confira a caixa de spam.</p>
      </div>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="space-y-4"
      >
        <div className="space-y-1.5">
          <label htmlFor="codigo" className="text-sm font-medium text-ink">
            Código de acesso
          </label>
          <input
            ref={inputRef}
            id="codigo"
            name="code"
            value={code}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
              setCode(digits);
              setError(null);
              if (digits.length === 6) submit(digits);
            }}
            inputMode="numeric"
            autoComplete="one-time-code"
            spellCheck={false}
            pattern="\d{6}"
            maxLength={6}
            // O código é o único campo da etapa: foco automático evita um toque extra.
            autoFocus
            placeholder="000000"
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? "codigo-erro" : undefined}
            className={cn(
              "tabular h-14 w-full rounded-control border bg-white text-center text-3xl font-medium tracking-[0.4em] text-ink placeholder:text-line-strong",
              "focus:border-pine-700 focus:outline-none focus:ring-2 focus:ring-gold-300",
              error ? "border-berry-600" : "border-line-strong",
            )}
          />
          {error && (
            <p id="codigo-erro" aria-live="polite" className="text-sm text-berry-700">
              {error}
            </p>
          )}
        </div>
        <Button type="submit" size="lg" className="w-full" loading={pending}>
          {pending ? "Entrando…" : "Entrar"}
        </Button>
      </form>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-[15px]">
        <button type="button" onClick={onChangeEmail} className="text-ink-2 underline underline-offset-4 hover:text-ink">
          Usar outro e-mail
        </button>
        <button
          type="button"
          onClick={resend}
          disabled={cooldown > 0 || resending}
          className="text-ink-2 underline underline-offset-4 hover:text-ink disabled:cursor-not-allowed disabled:text-ink-3 disabled:no-underline"
        >
          {resending ? "Enviando…" : cooldown > 0 ? `Reenviar em ${cooldown}s` : "Reenviar código"}
        </button>
      </div>
    </div>
  );
}
