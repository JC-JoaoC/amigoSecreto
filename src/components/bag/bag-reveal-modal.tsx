"use client";

import { type CSSProperties, useEffect, useRef } from "react";
import { Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { Sack } from "./sack";

type Person = { userId: string; name: string; avatarUrl: string | null; position: number };

export type Reveal =
  | {
      kind: "drawn";
      person: Person;
      /** Quantos nomes continuam no saco depois deste. */
      remaining: number;
      /** Este foi o penúltimo: quem sobrou já é o vencedor (revelado no próximo passo). */
      winnerNext: boolean;
    }
  | { kind: "winner"; person: Person };

/** 12 raios em volta do papel quando ele abre. */
const RAYS = Array.from({ length: 12 }, (_, i) => i * 30);

const CONFETTI_COLORS = ["#e8d38a", "#c9a227", "#b8232f", "#f9dfe0", "#dcefe3", "#ffffff"];
/** Confete determinístico (sem Math.random no render): espalha em leque e cai. */
const CONFETTI = Array.from({ length: 44 }, (_, i) => {
  const angle = (i / 44) * Math.PI * 2 + (i % 3) * 0.35;
  const dist = 150 + ((i * 37) % 120);
  return {
    "--x": `${Math.round(Math.cos(angle) * dist)}px`,
    "--y": `${Math.round(Math.sin(angle) * dist * 0.7 + 140)}px`,
    "--r": `${((i * 97) % 720) - 360}deg`,
    "--d": `${(i % 6) * 0.04}s`,
    background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  } as CSSProperties;
});

/**
 * Revelação em tela cheia: o saco chacoalha, um papel dobrado voa para fora e abre com o nome.
 * Para o vencedor, a mesma coreografia com confete. Usa <dialog> nativo (foco preso, ESC fecha).
 */
export function BagRevealModal({
  reveal,
  drawing,
  canDraw,
  onClose,
  onDrawNext,
  onShowWinner,
}: {
  reveal: Reveal | null;
  /** Organizador pediu o próximo nome e a resposta ainda não chegou. */
  drawing: boolean;
  canDraw: boolean;
  onClose: () => void;
  onDrawNext: () => void;
  onShowWinner: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const open = reveal !== null;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const winner = reveal?.kind === "winner";
  const label = !reveal ? "" : winner ? `Ficou por último no saco: ${reveal.person.name}` : `Saiu do saco: ${reveal.person.name}`;

  return (
    <dialog
      ref={ref}
      aria-label={drawing ? "Tirando o próximo nome" : label}
      data-kind={reveal?.kind}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="bag-reveal m-auto w-full max-w-none overflow-hidden bg-transparent p-0 text-white sm:max-w-xl"
    >
      {reveal && (
        <div className="relative px-4 pb-8 pt-6 sm:px-6">
          {drawing ? (
            <div className="flex h-[420px] flex-col items-center justify-end gap-6" aria-live="polite">
              <p className="text-lg font-medium text-pine-100">Chacoalhando o saco…</p>
              <Sack className="h-44 w-40 origin-bottom animate-shake" />
            </div>
          ) : (
            <Stage key={`${reveal.kind}-${reveal.person.position}`} reveal={reveal} />
          )}

          {!drawing && (
            <div key={`acoes-${reveal.kind}-${reveal.person.position}`} className="bag-reveal-after mt-6 flex flex-col items-center gap-4 text-center">
              {reveal.kind === "drawn" ? (
                reveal.winnerNext ? (
                  <>
                    <p className="text-lg text-pine-100">Só sobrou 1 nome no saco…</p>
                    <Button variant="accent" size="lg" onClick={onShowWinner} autoFocus>
                      Revelar quem ficou
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-lg text-pine-100">
                      {reveal.remaining === 2 ? "Restam 2 no saco. O próximo define quem ganha." : `Ainda ${reveal.remaining} no saco.`}
                    </p>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row">
                      <Button variant="outline" size="lg" onClick={onClose}>
                        Fechar
                      </Button>
                      {canDraw && (
                        <Button variant="accent" size="lg" onClick={onDrawNext} autoFocus>
                          Tirar próximo nome
                        </Button>
                      )}
                    </div>
                  </>
                )
              ) : (
                <Button variant="outline" size="lg" onClick={onClose} autoFocus>
                  Fechar
                </Button>
              )}
            </div>
          )}

          {/* Depois do conteúdo no DOM: o foco inicial vai para a ação principal, não para o X. */}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-2 top-2 grid size-10 place-items-center rounded-[var(--radius-control)] text-pine-100 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Fechar"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
      )}
    </dialog>
  );
}

function Stage({ reveal }: { reveal: Reveal }) {
  const winner = reveal.kind === "winner";
  return (
    <div className="relative mx-auto h-[420px] w-full max-w-md">
      {/* Cartão que abre com o nome */}
      <div className="absolute inset-x-0 top-6 z-20 flex justify-center">
        <div
          className={cn(
            "bag-reveal-card slip relative w-[min(100%,23rem)] px-6 pb-6 pt-5 text-center text-ink shadow-[var(--shadow-float)]",
            winner && "ring-4 ring-gold-300",
          )}
        >
          {winner ? (
            <p className="flex items-center justify-center gap-2 text-sm font-medium text-berry-700">
              <Trophy className="size-4" aria-hidden /> Ficou por último no saco
            </p>
          ) : (
            <p className="text-sm text-ink-2">Saiu do saco · {reveal.person.position}º nome</p>
          )}
          <p
            data-testid="bag-reveal-name"
            className={cn("bag-reveal-name mt-1 break-words font-hand leading-[1.02] text-ink", winner ? "text-[52px] sm:text-[60px]" : "text-[46px] sm:text-[52px]")}
          >
            {reveal.person.name}
          </p>
          {winner && <p className="bag-reveal-name mt-2 text-xl font-bold text-pine-800">Ganhou!</p>}
        </div>
      </div>

      {/* Raios saindo do papel */}
      <div className="pointer-events-none absolute left-1/2 top-[96px] z-10 size-0" aria-hidden>
        {RAYS.map((a) => (
          <span key={a} className="bag-reveal-ray" style={{ "--a": `${a}deg` } as CSSProperties} />
        ))}
      </div>

      {winner && (
        <div className="pointer-events-none absolute inset-0 z-30" aria-hidden>
          {CONFETTI.map((style, i) => (
            <span key={i} className="bag-confetti" style={style} />
          ))}
        </div>
      )}

      {/* Papel dobrado: começa dentro do saco (atrás dele) e voa para cima */}
      <div className="bag-reveal-paper slip absolute left-1/2 top-[262px] z-0 h-11 w-[4.5rem]" aria-hidden />

      {/* Saco */}
      <div className="absolute bottom-0 left-1/2 z-10 -translate-x-1/2">
        <div className="bag-reveal-sack">
          <Sack className="h-44 w-40" />
        </div>
      </div>
    </div>
  );
}
