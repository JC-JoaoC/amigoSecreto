"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { deleteGiftAction } from "@/app/actions/gifts";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/misc";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { LIMITS } from "@/lib/validation";
import { GiftCard, GiftList, type GiftView } from "./gift-card";
import { GiftForm } from "./gift-form";

type Editing = { mode: "create" } | { mode: "edit"; gift: GiftView } | null;

const iconButton =
  "grid size-9 place-items-center rounded-control transition-colors hover:bg-mist-2";

export function MyGifts({ gifts }: { gifts: GiftView[] }) {
  const toast = useToast();
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<GiftView | null>(null);
  const [pending, startTransition] = useTransition();
  const atLimit = gifts.length >= LIMITS.giftsPerUser;

  const addButton = (
    <Button onClick={() => setEditing({ mode: "create" })} disabled={atLimit} icon={<Plus className="size-4" aria-hidden />}>
      Adicionar presente
    </Button>
  );

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-ink">
          Sua lista{" "}
          <span className="tabular font-normal text-ink-3" aria-live="polite">
            {gifts.length}
            {atLimit ? ` de ${LIMITS.giftsPerUser} (limite)` : ""}
          </span>
        </h2>
        {gifts.length > 0 && addButton}
      </div>

      {gifts.length === 0 ? (
        <EmptyState
          title="Sua lista está vazia"
          description="Adicione links de produtos que você gostaria de ganhar. Quem te tirar vai agradecer a dica."
          action={addButton}
        />
      ) : (
        <GiftList>
          {gifts.map((g) => (
            <GiftCard
              key={g.id}
              gift={g}
              actions={
                <>
                  <button
                    type="button"
                    onClick={() => setEditing({ mode: "edit", gift: g })}
                    className={`${iconButton} text-ink-2 hover:text-ink`}
                    aria-label={`Editar ${g.title}`}
                  >
                    <Pencil className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(g)}
                    className={`${iconButton} text-berry-700`}
                    aria-label={`Excluir ${g.title}`}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </>
              }
            />
          ))}
        </GiftList>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.mode === "edit" ? "Editar presente" : "Adicionar presente"}
        description="Todo mundo vê sua lista. Só você altera."
      >
        {editing && (
          <GiftForm
            key={editing.mode === "edit" ? editing.gift.id : "new"}
            gift={editing.mode === "edit" ? editing.gift : undefined}
            onDone={() => setEditing(null)}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Excluir presente?"
        description={
          <>
            <strong className="font-medium text-ink">{deleting?.title}</strong> sai da sua lista. Não dá para desfazer.
          </>
        }
        confirmLabel="Excluir"
        loading={pending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          startTransition(async () => {
            const r = await deleteGiftAction(deleting.id);
            if (r.ok) toast.success(r.message ?? "Presente removido.");
            else toast.error(r.error);
            setDeleting(null);
          });
        }}
      />
    </>
  );
}
