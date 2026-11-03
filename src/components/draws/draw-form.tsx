"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { createDrawAction, updateDrawAction } from "@/app/actions/draws";
import { Button } from "@/components/ui/button";
import { InputField, TextareaField, focusFirstError } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { toDateInput } from "@/lib/format";
import { LIMITS, drawInputSchema, fieldErrorsOf } from "@/lib/validation";

export type DrawFormValues = {
  id: string;
  name: string;
  description: string | null;
  budget: string | null;
  eventDate: Date | string | null;
};

type Errors = Partial<Record<"name" | "description" | "budget" | "eventDate" | "form", string>>;

export function DrawForm({ draw, onDone, onCancel }: { draw?: DrawFormValues; onDone: () => void; onCancel: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState({
    name: draw?.name ?? "",
    description: draw?.description ?? "",
    budget: draw?.budget ?? "",
    eventDate: toDateInput(draw?.eventDate),
  });
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
        const parsed = drawInputSchema.safeParse(values);
        if (!parsed.success) {
          const fe = fieldErrorsOf(parsed.error);
          setErrors(Object.fromEntries(Object.entries(fe).map(([k, v]) => [k, v?.[0]])));
          focusFirstError(formRef.current);
          return;
        }
        startTransition(async () => {
          const r = draw ? await updateDrawAction(draw.id, values) : await createDrawAction(values);
          if (!r.ok) {
            const fe = r.fieldErrors ?? {};
            setErrors({ ...Object.fromEntries(Object.entries(fe).map(([k, v]) => [k, v?.[0]])), form: r.fieldErrors ? undefined : r.error });
            return;
          }
          toast.success(r.message ?? "Salvo!");
          onDone();
          if (!draw && r.data && "id" in r.data) router.push(`/sorteios/${r.data.id}`);
        });
      }}
    >
      <InputField label="Nome do sorteio" placeholder="Ex.: Amigo secreto da família 2026" autoComplete="off" value={values.name} onChange={set("name")} error={errors.name} maxLength={LIMITS.drawNameMax} autoFocus required />
      <div className="grid gap-5 sm:grid-cols-2">
        <InputField label="Valor sugerido" optional placeholder="Ex.: R$ 100" autoComplete="off" value={values.budget} onChange={set("budget")} error={errors.budget} maxLength={LIMITS.drawBudgetMax} />
        <InputField label="Data da troca" optional type="date" value={values.eventDate} onChange={set("eventDate")} error={errors.eventDate} />
      </div>
      <TextareaField label="Recado para a turma" optional placeholder="Local, horário, regras combinadas…" autoComplete="off" value={values.description} onChange={set("description")} error={errors.description} maxLength={LIMITS.drawDescriptionMax} />
      {errors.form && (
        <p aria-live="polite" className="rounded-panel bg-berry-50 p-3 text-[15px] text-berry-700">
          {errors.form}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onCancel} disabled={pending}>Cancelar</Button>
        <Button type="submit" loading={pending}>{pending ? "Salvando…" : draw ? "Salvar" : "Criar sorteio"}</Button>
      </div>
    </form>
  );
}
