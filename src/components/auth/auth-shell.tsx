import type { ReactNode } from "react";
import { GiftRow } from "@/components/gift-pile";
import { Container } from "@/components/ui/misc";
import { sampleFirstNames } from "@/server/services/users";

/** Telas de entrada: formulário à esquerda; à direita, como funciona (com nomes reais da turma). */
export async function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const names = await sampleFirstNames(12).catch(() => []);
  return (
    <Container className="grid gap-12 py-12 sm:py-16 lg:grid-cols-[minmax(0,26rem)_1fr] lg:gap-20">
      <section className="animate-rise">
        <h1 className="text-[28px] font-bold leading-tight text-ink">{title}</h1>
        <p className="mb-8 mt-2 text-base text-ink-2">{subtitle}</p>
        {children}
      </section>

      <aside aria-labelledby="como-funciona" className="hidden rounded-panel bg-mist p-10 lg:block">
        <GiftRow names={names} />
        <h2 id="como-funciona" className="mt-10 text-xl font-bold text-ink">
          Como funciona
        </h2>
        <div className="mt-4 max-w-md space-y-4 text-base text-ink">
          <p>
            <strong className="font-medium">E-mail e senha.</strong> Você cria a senha no cadastro e entra com ela. Esqueceu?
            Mandamos um link para o seu e-mail para criar outra.
          </p>
          <p>
            <strong className="font-medium">Sua lista, com links.</strong> Cadastre o que você gostaria de ganhar. Todo mundo vê;
            só você edita.
          </p>
          <p>
            <strong className="font-medium">O papel é só seu.</strong> No dia do sorteio, você abre o seu papel e vê quem tirou.
            Nem quem organiza sabe os pares.
          </p>
        </div>
      </aside>
    </Container>
  );
}
