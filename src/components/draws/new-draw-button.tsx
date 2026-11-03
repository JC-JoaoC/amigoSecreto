"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { DrawForm } from "./draw-form";

export function NewDrawButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} icon={<Plus className="size-4" aria-hidden />}>
        Novo sorteio
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Novo sorteio" description="Depois de criar, você adiciona os participantes.">
        {open && <DrawForm onDone={() => setOpen(false)} onCancel={() => setOpen(false)} />}
      </Modal>
    </>
  );
}
