"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { registerAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { InputField, focusFirstError } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";
import { useToast } from "@/components/ui/toast";
import { fieldErrorsOf, registerSchema } from "@/lib/validation";

type Errors = { name?: string; email?: string; password?: string; form?: string };

export function RegisterForm({ initialEmail = "", next }: { initialEmail?: string; next?: string }) {
  const router = useRouter();
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [emailTaken, setEmailTaken] = useState(false);
  const [pending, startTransition] = useTransition();

  const normalizedEmail = email.trim().toLowerCase();

  return (
    <form
      ref={formRef}
      noValidate
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        setEmailTaken(false);
        const parsed = registerSchema.safeParse({ name, email, password });
        if (!parsed.success) {
          const fe = fieldErrorsOf(parsed.error);
          setErrors({ name: fe.name?.[0], email: fe.email?.[0], password: fe.password?.[0] });
          focusFirstError(formRef.current);
          return;
        }
        setErrors({});
        startTransition(async () => {
          const r = await registerAction({ ...parsed.data, next });
          if (!r.ok) {
            const fe = r.fieldErrors ?? {};
            setErrors({ name: fe.name?.[0], email: fe.email?.[0], password: fe.password?.[0], form: r.fieldErrors ? undefined : r.error });
            if (fe.email?.[0]?.includes("já tem cadastro")) setEmailTaken(true);
            focusFirstError(formRef.current);
            return;
          }
          toast.success("Conta criada! Enviamos um link para confirmar seu e-mail.");
          router.replace(r.data.redirectTo);
          router.refresh();
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
        <p className="text-[15px] text-ink-2">
          <Link href={`/entrar?email=${encodeURIComponent(normalizedEmail)}`} className="font-medium text-ink underline underline-offset-4">
            Entrar com este e-mail
          </Link>{" "}
          ou{" "}
          <Link href={`/esqueci-senha?email=${encodeURIComponent(normalizedEmail)}`} className="font-medium text-ink underline underline-offset-4">
            criar uma nova senha
          </Link>
        </p>
      )}

      <PasswordField
        label="Senha"
        name="new-password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => {
          setPassword(e.target.value);
          setErrors((x) => ({ ...x, password: undefined }));
        }}
        error={errors.password}
        hint="Pelo menos 8 caracteres. Evite usar a mesma senha de outros sites."
        required
      />

      {errors.form && (
        <p aria-live="polite" className="rounded-panel bg-berry-50 p-3 text-[15px] text-berry-700">
          {errors.form}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {pending ? "Criando conta…" : "Criar conta"}
      </Button>

      <p className="text-[13px] text-ink-3">
        Pedimos só seu nome, e-mail e senha, e eles servem apenas para o amigo secreto.{" "}
        <Link href="/privacidade" className="underline underline-offset-4 hover:text-ink">
          Como cuidamos dos seus dados
        </Link>
      </p>

      <p className="text-[15px] text-ink-2">
        Já tem conta?{" "}
        <Link href="/entrar" className="font-medium text-ink underline underline-offset-4">
          Entrar
        </Link>
      </p>
    </form>
  );
}
