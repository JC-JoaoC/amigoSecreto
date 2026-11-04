"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { confirmEmailAction, forgotPasswordAction, resetPasswordAction } from "@/app/actions/auth";
import { Button, ButtonLink } from "@/components/ui/button";
import { InputField, focusFirstError } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";
import { useToast } from "@/components/ui/toast";
import { emailSchema, passwordSchema } from "@/lib/validation";

/** "Esqueci minha senha": pede o e-mail e mostra a mesma resposta exista ou não a conta. */
export function ForgotPasswordForm({ initialEmail = "" }: { initialEmail?: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState<string | undefined>();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (sentTo) {
    return (
      <div aria-live="polite" className="animate-rise space-y-5">
        <div className="rounded-panel bg-pine-50 px-5 py-4">
          <p className="font-medium text-ink">Confira seu e-mail</p>
          <p className="mt-1 text-[15px] text-ink-2">
            Se houver uma conta com <strong className="font-medium text-ink [overflow-wrap:anywhere]">{sentTo}</strong>, enviamos um
            link para criar uma nova senha. Ele vale por 30 minutos. Não chegou? Veja a caixa de spam.
          </p>
        </div>
        <ButtonLink href="/entrar" variant="outline">
          Voltar para entrar
        </ButtonLink>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      noValidate
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = emailSchema.safeParse(email);
        if (!parsed.success) {
          setError(parsed.error.issues[0]?.message);
          focusFirstError(formRef.current);
          return;
        }
        startTransition(async () => {
          const r = await forgotPasswordAction({ email: parsed.data });
          if (!r.ok) {
            setError(r.error);
            focusFirstError(formRef.current);
            return;
          }
          setSentTo(r.data.email);
        });
      }}
    >
      <InputField
        label="E-mail da sua conta"
        type="email"
        name="email"
        autoComplete="email"
        inputMode="email"
        spellCheck={false}
        placeholder="voce@exemplo.com"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          setError(undefined);
        }}
        error={error}
        required
      />
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {pending ? "Enviando…" : "Enviar link para nova senha"}
      </Button>
      <p className="text-[15px] text-ink-2">
        Lembrou?{" "}
        <Link href="/entrar" className="font-medium text-ink underline underline-offset-4">
          Entrar
        </Link>
      </p>
    </form>
  );
}

/** Página aberta pelo link do e-mail: define a nova senha e já entra na conta. */
export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [linkInvalid, setLinkInvalid] = useState(false);
  const [pending, startTransition] = useTransition();

  if (linkInvalid) {
    return (
      <div aria-live="polite" className="space-y-5">
        <p className="rounded-panel bg-berry-50 p-4 text-[15px] text-berry-700">
          Este link expirou ou já foi usado. Os links valem por 30 minutos e funcionam uma vez só.
        </p>
        <ButtonLink href="/esqueci-senha">Pedir um novo link</ButtonLink>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      noValidate
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = passwordSchema.safeParse(password);
        if (!parsed.success) {
          setError(parsed.error.issues[0]?.message);
          focusFirstError(formRef.current);
          return;
        }
        startTransition(async () => {
          const r = await resetPasswordAction({ token, password });
          if (!r.ok) {
            if (r.code === "TOKEN_INVALID") setLinkInvalid(true);
            else setError(r.error);
            return;
          }
          toast.success("Nova senha salva. Você já entrou na sua conta.");
          router.replace(r.data.redirectTo);
          router.refresh();
        });
      }}
    >
      <PasswordField
        label="Nova senha"
        name="new-password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => {
          setPassword(e.target.value);
          setError(undefined);
        }}
        error={error}
        hint="Pelo menos 8 caracteres. As outras sessões abertas serão encerradas."
        required
      />
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {pending ? "Salvando…" : "Salvar nova senha"}
      </Button>
    </form>
  );
}

/**
 * Confirmação de e-mail com um clique. Não confirma sozinho ao abrir a página:
 * alguns provedores de e-mail abrem os links para checar segurança, e isso gastaria o link.
 */
export function ConfirmEmailButton({ token }: { token: string }) {
  const [state, setState] = useState<{ ok: true; isOrganizer: boolean } | { ok: false; error: string } | null>(null);
  const [pending, startTransition] = useTransition();

  if (state?.ok) {
    return (
      <div aria-live="polite" className="space-y-5">
        <div className="rounded-panel bg-pine-50 px-5 py-4">
          <p className="font-medium text-ink">E-mail confirmado.</p>
          {state.isOrganizer && (
            <p className="mt-1 text-[15px] text-ink-2">Sua conta já tem permissão de organizador para criar e realizar sorteios.</p>
          )}
        </div>
        <ButtonLink href={state.isOrganizer ? "/sorteios" : "/"}>{state.isOrganizer ? "Ir para os sorteios" : "Ir para o início"}</ButtonLink>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button
        size="lg"
        className="w-full"
        loading={pending}
        onClick={() =>
          startTransition(async () => {
            const r = await confirmEmailAction(token);
            setState(r.ok ? { ok: true, isOrganizer: r.data.isOrganizer } : { ok: false, error: r.error });
          })
        }
      >
        {pending ? "Confirmando…" : "Confirmar meu e-mail"}
      </Button>
      {state && !state.ok && (
        <p aria-live="polite" className="rounded-panel bg-berry-50 p-3 text-[15px] text-berry-700">
          {state.error} Se você já entrou na conta, peça um novo link em{" "}
          <Link href="/conta" className="underline underline-offset-4">
            Conta
          </Link>
          .
        </p>
      )}
    </div>
  );
}
