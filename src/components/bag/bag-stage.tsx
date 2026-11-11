"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Trophy } from "lucide-react";
import { drawNextFromBagAction } from "@/app/actions/bag-draws";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { BagRevealModal, type Reveal } from "./bag-reveal-modal";
import type { BagStatus } from "./bag-status-badge";
import { Sack } from "./sack";

type Drawn = { userId: string; name: string; avatarUrl: string | null; position: number };

export function BagStage({
  bagId,
  status,
  canDraw,
  inBagCount,
  drawn,
  winner,
}: {
  bagId: string;
  status: BagStatus;
  canDraw: boolean;
  inBagCount: number;
  drawn: Drawn[];
  winner: Drawn | null;
}) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [confirmStart, setConfirmStart] = useState(false);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const latest = drawn.at(-1) ?? null;
  const canStart = inBagCount >= 2;

  // Quando chega um nome novo (pela ação do organizador ou pela atualização automática de quem
  // acompanha), abre a revelação. Na primeira renderização não abre: é só a página carregando.
  const snapshot = `${drawn.length}:${winner?.userId ?? ""}`;
  const [seen, setSeen] = useState(snapshot);
  if (snapshot !== seen) {
    setSeen(snapshot);
    if (latest && drawn.length > Number(seen.split(":")[0])) {
      setReveal({ kind: "drawn", person: latest, remaining: inBagCount, winnerNext: winner !== null });
    } else if (winner) {
      setReveal({ kind: "winner", person: winner });
    }
  }

  function drawNext() {
    setConfirmStart(false);
    startTransition(async () => {
      const r = await drawNextFromBagAction(bagId);
      if (!r.ok) {
        toast.error(r.error);
        setReveal(null);
      }
    });
  }

  return (
    <section aria-label="Saco de nomes" className="space-y-6">
      {winner ? (
        <WinnerCard winner={winner} />
      ) : (
        <div className="grid items-center gap-6 rounded-panel border border-line bg-white p-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:p-8">
          <div className="flex flex-col items-center gap-4">
            <Sack count={inBagCount} className={cn("h-40 w-36 origin-bottom", pending && "animate-shake")} />
            {canDraw && (
              <Button
                variant="accent"
                size="lg"
                className="w-full sm:w-auto"
                loading={pending}
                disabled={status === "OPEN" && !canStart}
                onClick={() => (status === "OPEN" ? setConfirmStart(true) : drawNext())}
              >
                {pending ? "Chacoalhando…" : status === "OPEN" ? "Tirar o primeiro nome" : "Tirar próximo nome"}
              </Button>
            )}
            {canDraw && status === "OPEN" && !canStart && (
              <p className="text-center text-[13px] text-ink-3">Coloque pelo menos 2 pessoas no saco.</p>
            )}
          </div>

          <div className="flex min-h-40 items-center justify-center">
            {latest ? (
              <div className="slip w-full max-w-sm px-6 pb-6 pt-5">
                <p className="text-sm text-ink-2">Último a sair · {latest.position}º nome</p>
                <p data-testid="bag-latest-name" className="mt-1 break-words font-hand text-[44px] leading-[1.05] text-ink">
                  {latest.name}
                </p>
                <p className="mt-3 text-[15px] text-ink-2">
                  {inBagCount === 2 ? "Só restam 2 no saco. O próximo define quem ganha." : `Ainda ${inBagCount} no saco.`}
                </p>
              </div>
            ) : (
              <div className="slip flex h-28 w-full max-w-sm items-center justify-center px-6">
                <span className="font-hand text-[28px] leading-none text-ink-3">
                  {status === "OPEN" ? "o primeiro nome sai aqui" : "aguardando"}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {drawn.length > 0 && <DrawnOrder drawn={drawn} />}

      {!canDraw && status !== "COMPLETED" && <AutoRefresh />}

      <BagRevealModal
        reveal={reveal}
        drawing={pending && reveal !== null}
        canDraw={canDraw}
        onClose={() => setReveal(null)}
        onDrawNext={drawNext}
        onShowWinner={() => winner && setReveal({ kind: "winner", person: winner })}
      />

      <ConfirmDialog
        open={confirmStart}
        tone="primary"
        title="Começar a tirar nomes?"
        description={
          <>
            São <strong className="font-medium text-ink">{inBagCount} pessoas</strong> no saco. Depois que o primeiro nome
            sair, ninguém entra nem sai, e não dá para recomeçar.
          </>
        }
        confirmLabel="Sim, tirar o primeiro"
        loading={pending}
        onCancel={() => setConfirmStart(false)}
        onConfirm={drawNext}
      />
    </section>
  );
}

function WinnerCard({ winner }: { winner: Drawn }) {
  return (
    <div className="rounded-panel bg-pine-900 px-6 py-8 text-white sm:px-10 sm:py-10">
      <p className="flex items-center gap-2 text-[15px] text-pine-100">
        <Trophy className="size-4 text-gold-300" aria-hidden /> Ficou por último no saco
      </p>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
        <Avatar name={winner.name} seed={winner.userId} src={winner.avatarUrl} size="xl" />
        <p data-testid="bag-winner-name" className="break-words font-hand text-[52px] leading-[1.02] text-gold-300 sm:text-[64px]">
          {winner.name}
        </p>
      </div>
      <p className="mt-4 text-lg font-medium">Ganhou!</p>
    </div>
  );
}

function DrawnOrder({ drawn }: { drawn: Drawn[] }) {
  const newestFirst = [...drawn].reverse();
  return (
    <section aria-labelledby="titulo-ordem">
      <h2 id="titulo-ordem" className="mb-3 text-xl font-bold text-ink">
        Ordem de saída <span className="tabular font-normal text-ink-3">{drawn.length}</span>
      </h2>
      <ol className="divide-y divide-line rounded-panel border border-line bg-white">
        {newestFirst.map((p, i) => (
          <li key={p.userId} className={cn("flex min-h-13 items-center gap-3 px-4 py-2", i === 0 && "bg-mist")}>
            <span className="tabular w-8 shrink-0 text-right text-[15px] text-ink-3">{p.position}º</span>
            <Avatar name={p.name} seed={p.userId} src={p.avatarUrl} size="sm" />
            <span className="min-w-0 flex-1 truncate text-[15px] text-ink">{p.name}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Para quem acompanha de outro aparelho: atualiza a tela a cada poucos segundos. */
function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 4000);
    return () => clearInterval(t);
  }, [router]);
  return null;
}
