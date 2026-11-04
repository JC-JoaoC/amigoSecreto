import type { ReactNode } from "react";
import { ExternalLink, Gift as GiftIcon } from "lucide-react";
import { displayHost } from "@/lib/text";

export type GiftView = { id: string; title: string; url: string; description: string | null; imageUrl?: string | null };

/** Lista de presentes: um painel, uma linha por presente, ações em coluna fixa. */
export function GiftList({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-line rounded-panel border border-line bg-white">{children}</ul>;
}

/** Uma linha de presente. O link abre em nova aba sem acesso à nossa janela (noopener/noreferrer). */
export function GiftCard({ gift, actions }: { gift: GiftView; actions?: ReactNode }) {
  return (
    <li className="flex animate-rise flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-6 sm:px-5">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-control border border-line bg-white">
          {gift.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- já servida reduzida (WebP) pelo nosso servidor
            <img src={gift.imageUrl} alt="" width={64} height={64} loading="lazy" className="size-full object-contain p-1" />
          ) : (
            <GiftIcon className="size-5 text-ink-3" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="break-words text-base font-medium text-ink">{gift.title}</h3>
          {gift.description && (
            <p className="mt-0.5 whitespace-pre-line break-words text-[15px] text-ink-2">{gift.description}</p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <a
          href={gift.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="inline-flex h-9 max-w-[16rem] items-center gap-1.5 rounded-control border border-line-strong px-3 text-sm text-ink transition-colors hover:border-ink-3 hover:bg-mist"
        >
          <span className="truncate">
            Ver na loja <span className="text-ink-3">· {displayHost(gift.url)}</span>
          </span>
          <ExternalLink className="size-3.5 shrink-0 text-ink-3" aria-hidden />
          <span className="sr-only">(abre em nova aba)</span>
        </a>
        {actions}
      </div>
    </li>
  );
}
