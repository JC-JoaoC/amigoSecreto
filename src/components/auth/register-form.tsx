"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { registerAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { InputField, focusFirstError } from "@/components/ui/field";
import { fieldErrorsOf, registerSchema } from "@/lib/validation";
import { CodeStep } from "./code-step";

type Errors = { name?: string; email?: string; form?: string };

export function RegisterForm({ initialEmail = "", next }: { initialEmail?: string; next?: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [errors, setErrors] = useState<Errors>({});
  const [emailTaken, setEmailTaken] = useState(false);
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
        setEmailTaken(false);
        const parsed = registerSchema.safeParse({ name, email });
        if (!parsed.success) {
          const fe = fieldErrorsOf(parsed.error);
          setErrors({ name: fe.name?.[0], email: fe.email?.[0] });
          focusFirstError(formRef.current);
          return;
        }
        setErrors({});
        startTransition(async () => {
          const r = await registerAction(parsed.data);
          if (!r.ok) {
            setErrors({ name: r.fieldErrors?.name?.[0], email: r.fieldErrors?.email?.[0], form: r.fieldErrors ? undefined : r.error });
            if (r.fieldErrors?.email?.[0]?.includes("já tem cadastro")) setEmailTaken(true);
            focusFirstError(formRef.current);
            return;
          }
          setSentTo(r.data.email);
        });
      }}
    >
      <InputField
        label="Nome completo"
        name="name"
        autoComplete="name"
        placeholder="Ex.: Maria Clara Souza"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setErrors((x) => ({ ...x, name: undefined }));
        }}
        error={errors.name}
        hint="É assim que seus amigos vão te encontrar na lista."
        maxLength={80}
        required
      />
      <InputField
        label="E-mail"
        type="email"
        name="email"
        autoComplete="email"
        inputMode="email"
        spellCheck={false}
        placeholder="voce@exemplo.com"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          setEmailTaken(false);
          setErrors((x) => ({ ...x, email: undefined }));
        }}
        error={errors.email}
        hint="Você entra com ele. Ninguém mais vê seu e-mail."
        required
      />

      {emailTaken && (
        <p className="text-[15px]">
          <Link
            href={`/entrar?email=${encodeURIComponent(email.trim().toLowerCase())}`}
            className="font-medium text-ink underline underline-offset-4"
          >
            Entrar com este e-mail
          </Link>
        </p>
      )}

      {errors.form && (
        <p aria-live="polite" className="rounded-panel bg-berry-50 p-3 text-[15px] text-berry-700">
          {errors.form}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {pending ? "Criando conta…" : "Criar conta e receber código"}
      </Button>

      <p className="text-[15px] text-ink-2">
        Já tem conta?{" "}
        <Link href="/entrar" className="font-medium text-ink underline underline-offset-4">
          Entrar
        </Link>
        . Usamos só nome e e-mail —{" "}
        <Link href="/privacidade" className="underline underline-offset-4 hover:text-ink">
          veja como tratamos seus dados
        </Link>
        .
      </p>
    </form>
  );
}
