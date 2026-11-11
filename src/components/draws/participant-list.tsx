"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { removeBagEntryAction } from "@/app/actions/bag-draws";
import { removeParticipantAction } from "@/app/actions/draws";
import { Avatar } from "@/components/ui/avatar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";

type P = { userId: string; name: string; avatarUrl: string | null };

const COPY = {
  draw: {
    remove: removeParticipantAction,
    emptyTitle: "Ninguém entrou ainda",
    emptyDescription: "Quem entrar ou for adicionado pelo organizador aparece aqui.",
    removeLabel: "do sorteio",
    removeDescription: "sai deste sorteio",
  },
  bag: {
    remove: removeBagEntryAction,
    emptyTitle: "O saco está vazio",
    emptyDescription: "Quem o organizador colocar no saco aparece aqui.",
    removeLabel: "do saco",
    removeDescription: "sai do saco",
  },
} as const;

export function ParticipantList({
  drawId,
  participants,
  canRemove,
  currentUserId,
  kind = "draw",
}: {
  drawId: string;
  participants: P[];
  canRemove: boolean;
  currentUserId: string;
  kind?: keyof typeof COPY;
}) {
  const copy = COPY[kind];
  const toast = useToast();
  const [removing, setRemoving] = useState<P | null>(null);
  const [pending, startTransition] = useTransition();

  if (participants.length === 0) {
    return (
      <EmptyState
        title={copy.emptyTitle}
        description={copy.emptyDescription}
      />
    );
  }

  return (
    <>
      <ul className="divide-y divide-line rounded-panel border border-line bg-white">
        {participants.map((p) => (
          <li key={p.userId} className="flex min-h-13 items-center gap-3 px-4 py-2">
            <Avatar name={p.name} seed={p.userId} src={p.avatarUrl} size="sm" />
            <Link href={`/participantes/${p.userId}`} className="min-w-0 flex-1 truncate text-[15px] text-ink hover:underline">
              {p.name}
              {p.userId === currentUserId && <span className="text-ink-3"> (você)</span>}
            </Link>
            {canRemove && (
              <button
                type="button"
                onClick={() => setRemoving(p)}
                className="grid size-9 shrink-0 place-items-center rounded-control text-ink-3 transition-colors hover:bg-berry-50 hover:text-berry-700"
                aria-label={`Remover ${p.name} ${copy.removeLabel}`}
              >
                <X className="size-4" aria-hidden />
              </button>
            )}
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={removing !== null}
        title="Remover participante?"
        description={
          <>
            <strong className="font-medium text-ink">{removing?.name}</strong> {copy.removeDescription}. A conta e a lista de presentes continuam.
          </>
        }
        confirmLabel="Remover"
        loading={pending}
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (!removing) return;
          startTransition(async () => {
            const r = await copy.remove(drawId, removing.userId);
            if (r.ok) toast.success(r.message ?? "Removido.");
            else toast.error(r.error);
            setRemoving(null);
          });
        }}
      />
    </>
  );
}
