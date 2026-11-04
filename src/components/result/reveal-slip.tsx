"use client";

import { useRef, useState, useTransition } from "react";
import { revealMyResultAction } from "@/app/actions/draws";
import { Button, ButtonLink } from "@/components/ui/button";

type Receiver = { id: string; name: string; giftCount: number };

/**
 * O papel do sorteio. O nome NÃO vem no HTML da página: só é buscado no servidor
 * (com a sessão validada) quando a pessoa abre o papel.
 */
export function RevealSlip({ drawId, alreadyRevealed }: { drawId: string; alreadyRevealed: boolean }) {
  const [receiver, setReceiver] = useState<Receiver | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const resultRef = useRef<HTMLDivElement>(null);

  function open() {
    setError(null);
    startTransition(async () => {
      const r = await revealMyResultAction(drawId);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setReceiver(r.data.receiver);
      requestAnimationFrame(() => resultRef.current?.focus());
    });
  }

  if (!receiver) {
    return (
      <div className="flex flex-col items-start">
        <div className="slip flex h-28 w-full max-w-xs items-center justify-center px-6" aria-hidden>
          <span className="font-hand text-[28px] leading-none text-ink-3">dobrado e lacrado</span>
        </div>
        <p className="mt-5 max-w-xs text-[15px] text-ink-2">
          {alreadyRevealed
            ? "Você já abriu este papel. Pode abrir de novo quando quiser, mas confira se ninguém está olhando."
            : "Abra quando ninguém estiver olhando a sua tela."}
        </p>
        <Button variant="accent" size="lg" className="mt-4" onClick={open} loading={pending}>
          {pending ? "Abrindo…" : alreadyRevealed ? "Abrir de novo" : "Abrir meu papel"}
        </Button>
        {error && (
          <p aria-live="polite" className="mt-3 text-[15px] text-berry-700">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div ref={resultRef} tabIndex={-1} aria-live="polite" className="outline-none">
      <div className="slip w-full max-w-xs origin-top animate-unfold px-6 pb-6 pt-5">
        <p className="text-sm text-ink-2">Você tirou</p>
        <p data-testid="receiver-name" className="mt-1 break-words font-hand text-[44px] leading-[1.05] text-ink">
          {receiver.name}
        </p>
      </div>
      <p className="mt-5 max-w-xs text-base text-ink">Agora é segredo. Não conte para ninguém.</p>
      <p className="mt-1 text-[15px] text-ink-2">
        {receiver.giftCount === 0
          ? "A lista ainda está vazia. Mande uma mensagem anônima perguntando o que a pessoa gostaria."
          : `${receiver.giftCount} ${receiver.giftCount === 1 ? "ideia de presente" : "ideias de presente"} na lista.`}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <ButtonLink href={`/participantes/${receiver.id}`}>Ver lista de presentes</ButtonLink>
        <Button variant="ghost" onClick={() => setReceiver(null)}>
          Dobrar de novo
        </Button>
      </div>
    </div>
  );
}
