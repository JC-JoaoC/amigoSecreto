"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteDrawAction, runDrawAction } from "@/app/actions/draws";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { AddParticipants } from "./add-participants";
import { DrawForm, type DrawFormValues } from "./draw-form";

export function OrganizerActions({
  draw,
  participantCount,
}: {
  draw: DrawFormValues & { status: "OPEN" | "COMPLETED" };
  participantCount: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [dialog, setDialog] = useState<"run" | "delete" | "edit" | null>(null);
  const [pending, startTransition] = useTransition();
  const open = draw.status === "OPEN";
  const canRun = participantCount >= 2;

  return (
    <div className="flex flex-col gap-2">
      {open && (
        <>
          <Button variant="accent" size="lg" onClick={() => setDialog("run")} disabled={!canRun} aria-describedby={!canRun ? "sorteio-minimo" : undefined}>
            Realizar sorteio
          </Button>
          {!canRun && (
            <p id="sorteio-minimo" className="text-[13px] text-ink-3">
              Precisa de pelo menos 2 participantes.
            </p>
          )}
          <AddParticipants drawId={draw.id} />
          <Button variant="outline" onClick={() => setDialog("edit")}>
            Editar informações
          </Button>
        </>
      )}
      <Button variant="danger" onClick={() => setDialog("delete")}>
        Excluir sorteio
      </Button>

      <ConfirmDialog
        open={dialog === "run"}
        tone="primary"
        title="Realizar o sorteio agora?"
        description={
          <>
            O sorteio será entre os <strong className="font-medium text-ink">{participantCount} participantes</strong>. Depois disso
            ninguém entra ou sai, e não dá para refazer. Cada pessoa verá só quem tirou. Como organizador, você poderá consultar os
            pares e as mensagens em “Ver pares e mensagens”.
          </>
        }
        confirmLabel="Sim, sortear"
        loading={pending}
        onCancel={() => setDialog(null)}
        onConfirm={() =>
          startTransition(async () => {
            const r = await runDrawAction(draw.id);
            setDialog(null);
            if (r.ok) toast.success(r.message ?? "Sorteio realizado.");
            else toast.error(r.error);
          })
        }
      />

      <ConfirmDialog
        open={dialog === "delete"}
        title="Excluir este sorteio?"
        description={
          open
            ? "O sorteio e a lista de participantes serão apagados. As contas e listas de presentes continuam."
            : "O sorteio já foi realizado. Excluir apaga os resultados e as mensagens, e ninguém mais verá quem tirou. Faça isso depois da troca de presentes."
        }
        confirmLabel="Excluir definitivamente"
        loading={pending}
        onCancel={() => setDialog(null)}
        onConfirm={() =>
          startTransition(async () => {
            const r = await deleteDrawAction(draw.id);
            setDialog(null);
            if (r.ok) {
              toast.success(r.message ?? "Sorteio excluído.");
              router.push("/sorteios");
            } else toast.error(r.error);
          })
        }
      />

      <Modal open={dialog === "edit"} onClose={() => setDialog(null)} title="Editar sorteio">
        {dialog === "edit" && <DrawForm draw={draw} onDone={() => setDialog(null)} onCancel={() => setDialog(null)} />}
      </Modal>
    </div>
  );
}
