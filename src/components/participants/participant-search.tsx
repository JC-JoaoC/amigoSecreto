"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { LoaderCircle, Search, X } from "lucide-react";

/** Busca por nome: atualiza ?q= na URL (compartilhável) com debounce. */
export function ParticipantSearch({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(initialQuery);
  const [pending, startTransition] = useTransition();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (value.trim()) next.set("q", value.trim());
      else next.delete("q");
      next.delete("pagina");
      startTransition(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}#participantes`, { scroll: false }));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div role="search" className="relative w-full sm:max-w-xs">
      <label htmlFor="busca-participantes" className="sr-only">
        Buscar participante pelo nome
      </label>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
      <input
        id="busca-participantes"
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Buscar pelo nome…"
        autoComplete="off"
        maxLength={80}
        spellCheck={false}
        className="h-10 w-full rounded-[var(--radius-control)] border border-line-strong bg-white pl-9 pr-10 text-[16px] placeholder:text-ink-3/80 focus:border-pine-700 focus:outline-none focus:ring-2 focus:ring-gold-300 [&::-webkit-search-cancel-button]:hidden"
      />
      {pending ? (
        <LoaderCircle className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-ink-3" aria-label="Buscando…" />
      ) : value ? (
        <button
          type="button"
          onClick={() => setValue("")}
          className="absolute right-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-[var(--radius-control)] text-ink-3 hover:bg-mist-2 hover:text-ink"
          aria-label="Limpar busca"
        >
          <X className="size-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
