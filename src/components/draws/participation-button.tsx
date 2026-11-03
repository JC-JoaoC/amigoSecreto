"use client";

import { useState, useTransition } from "react";
import { joinDrawAction, leaveDrawAction } from "@/app/actions/draws";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

export function ParticipationButton({ drawId, isParticipant }: { drawId: string; isParticipant: boolean }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [confirmLeave, setConfirmLeave] = useState(false);

  function run(action: (id: string) => ReturnType<typeof joinDrawAction>) {
    startTransition(async () => {
      const r = await action(drawId);
      if (r.ok) toast.success(r.message ?? "Pronto!");
      else toast.error(r.error);
      setConfirmLeave(false);
    });
  }

  if (!isParticipant) {
    return (
      <Button variant="accent" size="lg" className="w-full" loading={pending} onClick={() => run(joinDrawAction)}>
        Quero participar
      </Button>
    );
  }

  return (
    <>
      <Button variant="outline" className="w-full" onClick={() => setConfirmLeave(true)}>
        Sair do sorteio
      </Button>
      <ConfirmDialog
        open={confirmLeave}
        title="Sair deste sorteio?"
        description="Você deixa de participar. Pode entrar de novo enquanto o sorteio não for realizado."
        confirmLabel="Sair do sorteio"
        loading={pending}
        onCancel={() => setConfirmLeave(false)}
        onConfirm={() => run(leaveDrawAction)}
      />
    </>
  );
}
