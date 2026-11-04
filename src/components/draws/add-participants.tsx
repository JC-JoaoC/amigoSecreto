"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, LoaderCircle, Search } from "lucide-react";
import { addParticipantsAction, searchAddableUsersAction } from "@/app/actions/draws";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";

type U = { id: string; name: string; avatarUrl: string | null };

/** Organizador escolhe pessoas cadastradas (e verificadas) para entrar no sorteio. */
export function AddParticipants({ drawId }: { drawId: string }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<U[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();
  const [saving, startSave] = useTransition();

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(
      () =>
        startSearch(async () => {
          const r = await searchAddableUsersAction(drawId, q);
          if (r.ok) {
            setUsers(r.data);
            setLoadError(null);
          } else setLoadError(r.error);
        }),
      q ? 250 : 0,
    );
    return () => clearTimeout(t);
  }, [open, q, drawId]);

  function close() {
    setOpen(false);
    setQ("");
    setSelected(new Set());
    setUsers(null);
  }

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const allVisibleSelected = users !== null && users.length > 0 && users.every((u) => selected.has(u.id));

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Adicionar participantes
      </Button>
      <Modal open={open} onClose={close} title="Adicionar participantes" description="Somente pessoas com conta confirmada aparecem aqui.">
        <div className="space-y-4">
          <div className="relative">
            <label htmlFor="busca-add" className="sr-only">Buscar pelo nome</label>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
            <input
              id="busca-add"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar pelo nome…"
              autoComplete="off"
              spellCheck={false}
              className="h-10 w-full rounded-control border border-line-strong bg-white pl-9 pr-10 text-[16px] focus:border-pine-700 focus:outline-none focus:ring-2 focus:ring-gold-300"
            />
            {searching && <LoaderCircle className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-ink-3" aria-label="Buscando…" />}
          </div>

          {loadError ? (
            <p aria-live="polite" className="rounded-panel bg-berry-50 p-3 text-[15px] text-berry-700">{loadError}</p>
          ) : users === null ? (
            <div className="space-y-2" aria-hidden>
              {[0, 1, 2].map((i) => <div key={i} className="skeleton h-13 rounded-control" />)}
            </div>
          ) : users.length === 0 ? (
            <p className="rounded-panel border border-dashed border-line-strong p-4 text-[15px] text-ink-2">
              {q ? "Ninguém encontrado com esse nome." : "Todas as pessoas cadastradas já estão neste sorteio."}
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-2">{selected.size} {selected.size === 1 ? "selecionada" : "selecionadas"}</span>
                <button
                  type="button"
                  className="font-medium text-ink underline underline-offset-4"
                  onClick={() =>
                    setSelected((s) => {
                      const n = new Set(s);
                      for (const u of users) {
                        if (allVisibleSelected) n.delete(u.id);
                        else n.add(u.id);
                      }
                      return n;
                    })
                  }
                >
                  {allVisibleSelected ? "Desmarcar todas" : "Selecionar todas"}
                </button>
              </div>
              <ul className="max-h-[45dvh] divide-y divide-line overflow-y-auto overscroll-contain rounded-panel border border-line">
                {users.map((u) => {
                  const on = selected.has(u.id);
                  return (
                    <li key={u.id}>
                      <label
                        className={cn(
                          "flex min-h-13 cursor-pointer items-center gap-3 px-3 transition-colors has-[input:focus-visible]:outline-2 has-[input:focus-visible]:-outline-offset-2 has-[input:focus-visible]:outline-gold-500",
                          on ? "bg-pine-50" : "bg-white hover:bg-mist",
                        )}
                      >
                        <input type="checkbox" className="peer sr-only" checked={on} onChange={() => toggle(u.id)} />
                        <Avatar name={u.name} seed={u.id} src={u.avatarUrl} size="sm" />
                        <span className="flex-1 text-[15px] text-ink">{u.name}</span>
                        <span className={cn("grid size-5 place-items-center rounded border-2", on ? "border-pine-900 bg-pine-900 text-white" : "border-line-strong")} aria-hidden>
                          {on && <Check className="size-4" />}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={close} disabled={saving}>Cancelar</Button>
            <Button
              loading={saving}
              disabled={selected.size === 0}
              onClick={() =>
                startSave(async () => {
                  const r = await addParticipantsAction(drawId, [...selected]);
                  if (!r.ok) {
                    toast.error(r.error);
                    return;
                  }
                  toast.success(r.data.added === 1 ? "1 participante adicionado." : `${r.data.added} participantes adicionados.`);
                  close();
                })
              }
            >
              Adicionar {selected.size > 0 ? `(${selected.size})` : ""}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
