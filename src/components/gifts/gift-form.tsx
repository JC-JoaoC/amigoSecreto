"use client";

import { useRef, useState, useTransition } from "react";
import { createGiftAction, updateGiftAction } from "@/app/actions/gifts";
import { Button } from "@/components/ui/button";
import { InputField, TextareaField, focusFirstError } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { LIMITS, fieldErrorsOf, giftInputSchema } from "@/lib/validation";
import type { GiftView } from "./gift-card";

type Errors = { title?: string; url?: string; description?: string; form?: string };

export function GiftForm({ gift, onDone, onCancel }: { gift?: GiftView; onDone: () => void; onCancel: () => void }) {
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [title, setTitle] = useState(gift?.title ?? "");
  const [url, setUrl] = useState(gift?.url ?? "");
  const [description, setDescription] = useState(gift?.description ?? "");
  const [errors, setErrors] = useState<Errors>({});
  const [pending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      noValidate
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const input = { title, url, description };
        const parsed = giftInputSchema.safeParse(input);
        if (!parsed.success) {
          const fe = fieldErrorsOf(parsed.error);
          setErrors({ title: fe.title?.[0], url: fe.url?.[0], description: fe.description?.[0] });
          focusFirstError(formRef.current);
          return;
        }
        setErrors({});
        startTransition(async () => {
          const r = gift ? await updateGiftAction(gift.id, input) : await createGiftAction(input);
          if (!r.ok) {
            const fe = r.fieldErrors ?? {};
            setErrors({ title: fe.title?.[0], url: fe.url?.[0], description: fe.description?.[0], form: r.fieldErrors ? undefined : r.error });
            focusFirstError(formRef.current);
            return;
          }
          toast.success(r.message ?? "Salvo!");
          onDone();
        });
      }}
    >
      <InputField
        label="Nome do presente"
        placeholder="Ex.: Fone Bluetooth JBL"
        autoComplete="off"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          setErrors((x) => ({ ...x, title: undefined }));
        }}
        error={errors.title}
        maxLength={LIMITS.giftTitleMax}
        autoFocus
        required
      />
      <InputField
        label="Link do produto"
        type="url"
        inputMode="url"
        placeholder="https://www.loja.com.br/produto"
        autoComplete="off"
        spellCheck={false}
        value={url}
        onChange={(e) => {
          setUrl(e.target.value);
          setErrors((x) => ({ ...x, url: undefined }));
        }}
        error={errors.url}
        hint="Cole o endereço da página do produto na loja."
        maxLength={LIMITS.giftUrlMax}
        required
      />
      <TextareaField
        label="Descrição"
        optional
        placeholder="Ex.: Preferencialmente na cor preta"
        value={description}
        onChange={(e) => {
          setDescription(e.target.value);
          setErrors((x) => ({ ...x, description: undefined }));
        }}
        error={errors.description}
        hint={`${description.length}/${LIMITS.giftDescriptionMax} · cor, tamanho, voltagem…`}
        maxLength={LIMITS.giftDescriptionMax}
      />
      {errors.form && (
        <p aria-live="polite" className="rounded-panel bg-berry-50 p-3 text-[15px] text-berry-700">
          {errors.form}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" loading={pending}>
          {pending ? "Salvando…" : gift ? "Salvar alterações" : "Adicionar presente"}
        </Button>
      </div>
    </form>
  );
}
