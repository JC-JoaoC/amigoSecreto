"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { loginAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { InputField, focusFirstError } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";
import { useToast } from "@/components/ui/toast";
import { fieldErrorsOf, loginSchema } from "@/lib/validation";

type Errors = { email?: string; password?: string; form?: string };

export function LoginForm({ next, initialEmail = "" }: { next?: string; initialEmail?: string }) {
  const router = useRouter();
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [pending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      noValidate
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = loginSchema.safeParse({ email, password });
        if (!parsed.success) {
          const fe = fieldErrorsOf(parsed.error);
          setErrors({ email: fe.email?.[0], password: fe.password?.[0] });
          focusFirstError(formRef.current);
          return;
        }
        setErrors({});
        startTransition(async () => {
          const r = await loginAction({ email: parsed.data.email, password, next });
          if (!r.ok) {
            setErrors({ form: r.error });
            return;
          }
          toast.success("Que bom te ver de novo.");
          router.replace(r.data.redirectTo);
          router.refresh();
        });
      }}
    >
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
          setErrors((x) => ({ ...x, email: undefined, form: undefined }));
        }}
        error={errors.email}
        required
      />
      <div className="space-y-1.5">
        <PasswordField
          label="Senha"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setErrors((x) => ({ ...x, password: undefined, form: undefined }));
          }}
          error={errors.password}
          required
        />
        <p className="text-right text-sm">
          <Link
            href={`/esqueci-senha${email ? `?email=${encodeURIComponent(email.trim().toLowerCase())}` : ""}`}
            className="text-ink-2 underline underline-offset-4 hover:text-ink"
          >
            Esqueci minha senha
          </Link>
        </p>
      </div>

      {errors.form && (
        <p aria-live="polite" className="rounded-panel bg-berry-50 p-3 text-[15px] text-berry-700">
          {errors.form}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {pending ? "Entrando…" : "Entrar"}
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
