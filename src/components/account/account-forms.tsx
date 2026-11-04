"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteAccountAction, updateNameAction } from "@/app/actions/account";
import { changePasswordAction, resendVerificationAction } from "@/app/actions/auth";
import { Button, buttonClasses } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { InputField } from "@/components/ui/field";
import { PasswordField } from "@/components/ui/password-field";
import { useToast } from "@/components/ui/toast";
import { LIMITS, changePasswordSchema, fieldErrorsOf, nameSchema } from "@/lib/validation";

export function NameForm({ initialName }: { initialName: string }) {
  const toast = useToast();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = nameSchema.safeParse(name);
        if (!parsed.success) {
          setError(parsed.error.issues[0]?.message);
          return;
        }
        startTransition(async () => {
          const r = await updateNameAction(parsed.data);
          if (r.ok) {
            setName(r.data.name);
            toast.success(r.message ?? "Salvo!");
          } else setError(r.error);
        });
      }}
    >
      <InputField
        label="Nome completo"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setError(undefined);
        }}
        error={error}
        maxLength={LIMITS.nameMax}
        autoComplete="name"
        name="name"
      />
      <Button type="submit" loading={pending} disabled={name.trim() === initialName}>
        {pending ? "Salvando…" : "Salvar nome"}
      </Button>
    </form>
  );
}

export function DataActions() {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <a href="/conta/dados" download className={buttonClasses("outline")}>
        Baixar meus dados (JSON)
      </a>
      <Button variant="danger" onClick={() => setOpen(true)}>
        Excluir minha conta
      </Button>

      <ConfirmDialog
        open={open}
        title="Excluir sua conta?"
        description="Apagamos seu cadastro, sua lista de presentes e suas sessões. Isso não pode ser desfeito."
        confirmLabel="Excluir conta"
        loading={pending}
        confirmDisabled={confirmation.trim().toUpperCase() !== "EXCLUIR"}
        onCancel={() => {
          setOpen(false);
          setConfirmation("");
          setError(null);
        }}
        onConfirm={() =>
          startTransition(async () => {
            const r = await deleteAccountAction(confirmation);
            if (!r.ok) {
              setError(r.error);
              return;
            }
            toast.success("Conta excluída.");
            router.replace("/");
            router.refresh();
          })
        }
      >
        <InputField
          label="Para confirmar, digite “EXCLUIR”"
          value={confirmation}
          onChange={(e) => {
            setConfirmation(e.target.value);
            setError(null);
          }}
          autoComplete="off"
          error={error ?? undefined}
        />
      </ConfirmDialog>
    </div>
  );
}

/** Troca de senha logado: pede a atual e encerra as outras sessões. */
export function ChangePasswordForm() {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ current?: string; password?: string; form?: string }>({});
  const [pending, startTransition] = useTransition();

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = changePasswordSchema.safeParse({ current, password });
        if (!parsed.success) {
          const fe = fieldErrorsOf(parsed.error);
          setErrors({ current: fe.current?.[0], password: fe.password?.[0] });
          return;
        }
        startTransition(async () => {
          const r = await changePasswordAction({ current, password });
          if (!r.ok) {
            const fe = r.fieldErrors ?? {};
            setErrors({ current: fe.current?.[0], password: fe.password?.[0], form: r.fieldErrors ? undefined : r.error });
            return;
          }
          setCurrent("");
          setPassword("");
          setErrors({});
          toast.success(r.message ?? "Senha alterada.");
        });
      }}
    >
      <PasswordField
        label="Senha atual"
        name="current-password"
        autoComplete="current-password"
        value={current}
        onChange={(e) => {
          setCurrent(e.target.value);
          setErrors((x) => ({ ...x, current: undefined }));
        }}
        error={errors.current}
      />
      <PasswordField
        label="Nova senha"
        name="new-password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => {
          setPassword(e.target.value);
          setErrors((x) => ({ ...x, password: undefined }));
        }}
        error={errors.password}
        hint="Pelo menos 8 caracteres."
      />
      {errors.form && (
        <p aria-live="polite" className="rounded-panel bg-berry-50 p-3 text-[15px] text-berry-700">
          {errors.form}
        </p>
      )}
      <Button type="submit" loading={pending} disabled={!current || !password}>
        {pending ? "Salvando…" : "Trocar senha"}
      </Button>
    </form>
  );
}

/** Reenvia o link de confirmação de e-mail. */
export function ResendVerificationButton() {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await resendVerificationAction();
          if (!r.ok) toast.error(r.error);
          else toast.success(r.data.alreadyVerified ? "Seu e-mail já está confirmado." : "Enviamos um novo link de confirmação.");
        })
      }
    >
      {pending ? "Enviando…" : "Reenviar link de confirmação"}
    </Button>
  );
}
