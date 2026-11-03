"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteAccountAction, updateNameAction } from "@/app/actions/account";
import { Button, buttonClasses } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { InputField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { LIMITS, nameSchema } from "@/lib/validation";

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
