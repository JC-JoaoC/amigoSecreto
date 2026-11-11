"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { createBagDrawAction, updateBagDrawAction } from "@/app/actions/bag-draws";
import { Button } from "@/components/ui/button";
import { InputField, TextareaField, focusFirstError } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { LIMITS, bagDrawInputSchema, fieldErrorsOf } from "@/lib/validation";

export type BagFormValues = { id: string; name: string; description: string | null };

type Errors = Partial<Record<"name" | "description" | "form", string>>;

export function BagForm({ bag, onDone, onCancel }: { bag?: BagFormValues; onDone: () => void; onCancel: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState({ name: bag?.name ?? "", description: bag?.description ?? "" });
  const [errors, setErrors] = useState<Errors>({});
  const [pending, startTransition] = useTransition();

  const set = (k: keyof typeof values) => (e: { target: { value: string } }) => {
    setValues((v) => ({ ...v, [k]: e.target.value }));
    setErrors((x) => ({ ...x, [k]: undefined }));
  };

  return (
    <form
      ref={formRef}
      noValidate
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = bagDrawInputSchema.safeParse(values);
        if (!parsed.success) {
          const fe = fieldErrorsOf(parsed.error);
          setErrors(Object.fromEntries(Object.entries(fe).map(([k, v]) => [k, v?.[0]])));
          focusFirstError(formRef.current);
          return;
        }
        startTransition(async () => {
          const r = bag ? await updateBagDrawAction(bag.id, values) : await createBagDrawAction(values);
          if (!r.ok) {
            const fe = r.fieldErrors ?? {};
            setErrors({ ...Object.fromEntries(Object.entries(fe).map(([k, v]) => [k, v?.[0]])), form: r.fieldErrors ? undefined : r.error });
            return;
          }
          toast.success(r.message ?? "Salvo!");
          onDone();
          if (!bag && r.data && "id" in r.data) router.push(`/saco/${r.data.id}`);
        });
      }}
    >
      <InputField label="Nome do sorteio" placeholder="Ex.: Prêmio da festa de fim de ano" autoComplete="off" value={values.name} onChange={set("name")} error={errors.name} maxLength={LIMITS.drawNameMax} autoFocus required />
      <TextareaField label="Recado para a turma" optional placeholder="O que ganha quem ficar por último no saco…" autoComplete="off" value={values.description} onChange={set("description")} error={errors.description} maxLength={LIMITS.drawDescriptionMax} />
      {errors.form && (
        <p aria-live="polite" className="rounded-panel bg-berry-50 p-3 text-[15px] text-berry-700">
          {errors.form}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onCancel} disabled={pending}>Cancelar</Button>
        <Button type="submit" loading={pending}>{pending ? "Salvando…" : bag ? "Salvar" : "Criar sorteio"}</Button>
      </div>
    </form>
  );
}
