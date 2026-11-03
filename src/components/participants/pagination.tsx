import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

function href(page: number, q: string) {
  const p = new URLSearchParams();
  if (q) p.set("q", q);
  if (page > 1) p.set("pagina", String(page));
  const s = p.toString();
  return `/${s ? `?${s}` : ""}#participantes`;
}

export function Pagination({ page, pageCount, q }: { page: number; pageCount: number; q: string }) {
  if (pageCount <= 1) return null;
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === pageCount || Math.abs(p - page) <= 1,
  );
  const item = "tabular grid h-10 min-w-10 place-items-center rounded-[var(--radius-control)] px-3 text-sm font-medium transition-colors";
  return (
    <nav aria-label="Paginação" className="mt-10 flex items-center justify-center gap-1.5">
      {page > 1 ? (
        <Link href={href(page - 1, q)} className={cn(item, "border border-line-strong bg-white text-ink hover:bg-mist")} aria-label="Página anterior">
          <ChevronLeft className="size-4" aria-hidden />
        </Link>
      ) : null}
      {pages.map((p, i) => (
        <span key={p} className="flex items-center gap-1.5">
          {i > 0 && pages[i - 1] !== p - 1 && <span className="px-1 text-ink-3" aria-hidden>…</span>}
          <Link
            href={href(p, q)}
            aria-current={p === page ? "page" : undefined}
            className={cn(item, p === page ? "bg-pine-800 text-white" : "border border-line-strong bg-white text-ink hover:bg-mist")}
          >
            {p}
          </Link>
        </span>
      ))}
      {page < pageCount ? (
        <Link href={href(page + 1, q)} className={cn(item, "border border-line-strong bg-white text-ink hover:bg-mist")} aria-label="Próxima página">
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      ) : null}
    </nav>
  );
}
