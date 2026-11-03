"use client";

import { Button, ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/misc";

/** Erro inesperado numa página: mensagem clara, sem detalhes internos, com o próximo passo. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Container className="max-w-2xl py-20">
      <h1 className="text-[28px] font-bold text-ink">Não conseguimos carregar esta página</h1>
      <p className="mt-2 text-base text-ink">Foi um problema do nosso lado. Tente de novo em alguns segundos.</p>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Button onClick={reset}>Tentar de novo</Button>
        <ButtonLink href="/" variant="outline">
          Ir para os participantes
        </ButtonLink>
      </div>
    </Container>
  );
}
