"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { requestCodeAction } from "@/app/actions/auth";
import { Button, ButtonLink } from "@/components/ui/button";
import { InputField, focusFirstError } from "@/components/ui/field";
import { emailSchema } from "@/lib/validation";
import { CodeStep } from "./code-step";

export function LoginForm({ next, initialEmail = "" }: { next?: string; initialEmail?: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (sentTo) {
    return <CodeStep email={sentTo} next={next} onChangeEmail={() => setSentTo(null)} />;
  }

  return (
    <form
      ref={formRef}
      noValidate
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        setNotFound(null);
        const parsed = emailSchema.safeParse(email);
        if (!parsed.success) {
          setError(parsed.error.issues[0]?.message ?? "E-mail inválido.");
          focusFirstError(formRef.current);
          return;
        }
        setError(null);
        startTransition(async () => {
          const r = await requestCodeAction({ email: parsed.data });
          if (!r.ok) {
            setError(r.error);
            focusFirstError(formRef.current);
            return;
          }
          if (r.data.status === "not_found") setNotFound(r.data.email);
          else setSentTo(r.data.email);
        });
      }}
    >
      <InputField
        label="Seu e-mail"
        type="email"
        name="email"
        autoComplete="email"
        inputMode="email"
        spellCheck={false}
        placeholder="voce@exemplo.com"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          setError(null);
        }}
        error={error ?? undefined}
        hint="Vamos enviar um código de acesso. Não existe senha."
        required
      />

      {notFound && (
        <div aria-live="polite" className="animate-rise rounded-panel bg-mist p-4">
          <p className="text-[15px] text-ink">
            Não encontramos uma conta com <strong className="break-all font-medium">{notFound}</strong>.
          </p>
          <ButtonLink
            href={`/cadastro?email=${encodeURIComponent(notFound)}${next ? `&next=${encodeURIComponent(next)}` : ""}`}
            size="sm"
            className="mt-3"
          >
            Criar conta com este e-mail
          </ButtonLink>
        </div>
      )}

      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {pending ? "Enviando código…" : "Receber código de acesso"}
      </Button>

      <p className="text-[15px] text-ink-2">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="font-medium text-ink underline underline-offset-4">
          Cadastre-se
        </Link>
      </p>
    </form>
  );
}
