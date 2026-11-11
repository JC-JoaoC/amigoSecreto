"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { BagForm } from "./bag-form";

export function NewBagButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} icon={<Plus className="size-4" aria-hidden />}>
        Novo sorteio do saco
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Novo sorteio do saco" description="Depois de criar, você coloca as pessoas no saco.">
        {open && <BagForm onDone={() => setOpen(false)} onCancel={() => setOpen(false)} />}
      </Modal>
    </>
  );
}
