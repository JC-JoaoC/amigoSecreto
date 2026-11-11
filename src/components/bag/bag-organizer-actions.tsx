"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { deleteBagDrawAction, setBagLastAction } from "@/app/actions/bag-draws";
import { AddParticipants } from "@/components/draws/add-participants";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { BagForm, type BagFormValues } from "./bag-form";
import type { BagStatus } from "./bag-status-badge";

type Person = { userId: string; name: string; avatarUrl: string | null };

/**
 * Painel do organizador. A escolha de quem fica por último NÃO aparece no painel
 * (a tela costuma ir para o telão); só dentro do modal "Definir o último nome".
 */
export function BagOrganizerActions({
  bag,
  inBag,
  lastUserId,
}: {
  bag: BagFormValues & { status: BagStatus };
  inBag: Person[];
  lastUserId: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [dialog, setDialog] = useState<"last" | "delete" | "edit" | null>(null);
  const [pending, startTransition] = useTransition();
  const open = bag.status === "OPEN";

  return (
    <div className="flex flex-col gap-2">
      {open && (
        <>
          <AddParticipants drawId={bag.id} kind="bag" />
          <Button variant="outline" onClick={() => setDialog("last")} disabled={inBag.length < 2}>
            Definir o último nome
          </Button>
        </>
      )}
      <Button variant="outline" onClick={() => setDialog("edit")}>
        Editar informações
      </Button>
      <Button variant="danger" onClick={() => setDialog("delete")}>
        Excluir sorteio
      </Button>

      <Modal
        open={dialog === "last"}
        onClose={() => setDialog(null)}
        title="Quem fica por último no saco?"
        description="A pessoa escolhida nunca sai antes das outras: ela sobra por último. Só organizadores veem esta escolha."
      >
        {dialog === "last" && (
          <ChooseLastForm
            bagId={bag.id}
            people={inBag}
            current={lastUserId}
            onDone={() => setDialog(null)}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={dialog === "delete"}
        title="Excluir este sorteio?"
        description="O sorteio e a ordem de saída dos nomes serão apagados. As contas continuam."
        confirmLabel="Excluir definitivamente"
        loading={pending}
        onCancel={() => setDialog(null)}
        onConfirm={() =>
          startTransition(async () => {
            const r = await deleteBagDrawAction(bag.id);
            setDialog(null);
            if (r.ok) {
              toast.success(r.message ?? "Sorteio excluído.");
              router.push("/saco");
            } else toast.error(r.error);
          })
        }
      />

      <Modal open={dialog === "edit"} onClose={() => setDialog(null)} title="Editar sorteio">
        {dialog === "edit" && <BagForm bag={bag} onDone={() => setDialog(null)} onCancel={() => setDialog(null)} />}
      </Modal>
    </div>
  );
}

function ChooseLastForm({
  bagId,
  people,
  current,
  onDone,
}: {
  bagId: string;
  people: Person[];
  current: string | null;
  onDone: () => void;
}) {
  const toast = useToast();
  const [selected, setSelected] = useState<string | null>(current);
  const [pending, startTransition] = useTransition();
  const options: (Person | null)[] = [null, ...people];

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="sr-only">Quem fica por último</legend>
        <ul className="max-h-[45dvh] divide-y divide-line overflow-y-auto overscroll-contain rounded-panel border border-line">
          {options.map((p) => {
            const value = p?.userId ?? null;
            const on = selected === value;
            return (
              <li key={value ?? "aleatorio"}>
                <label
                  className={cn(
                    "flex min-h-13 cursor-pointer items-center gap-3 px-3 transition-colors has-[input:focus-visible]:outline-2 has-[input:focus-visible]:-outline-offset-2 has-[input:focus-visible]:outline-gold-500",
                    on ? "bg-pine-50" : "bg-white hover:bg-mist",
                  )}
                >
                  <input type="radio" name="ultimo" className="sr-only" checked={on} onChange={() => setSelected(value)} />
                  {p ? (
                    <>
                      <Avatar name={p.name} seed={p.userId} src={p.avatarUrl} size="sm" />
                      <span className="flex-1 text-[15px] text-ink">{p.name}</span>
                    </>
                  ) : (
                    <span className="flex-1 py-2 text-[15px] text-ink">
                      Ninguém <span className="text-ink-3">· o último sai ao acaso</span>
                    </span>
                  )}
                  <span
                    className={cn("grid size-5 place-items-center rounded-full border-2", on ? "border-pine-900 bg-pine-900 text-white" : "border-line-strong")}
                    aria-hidden
                  >
                    {on && <Check className="size-3.5" />}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>
      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onDone} disabled={pending}>
          Cancelar
        </Button>
        <Button
          loading={pending}
          disabled={selected === current}
          onClick={() =>
            startTransition(async () => {
              const r = await setBagLastAction(bagId, selected);
              if (!r.ok) {
                toast.error(r.error);
                return;
              }
              toast.success(r.message ?? "Configuração salva.");
              onDone();
            })
          }
        >
          Salvar
        </Button>
      </div>
    </div>
  );
}
