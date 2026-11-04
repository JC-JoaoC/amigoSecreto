import { Suspense } from "react";
import { ParticipantDirectory } from "@/components/participants/participant-directory";
import { Pagination } from "@/components/participants/pagination";
import { ParticipantSearch } from "@/components/participants/participant-search";
import { GiftPile, GiftRow } from "@/components/gift-pile";
import { ButtonLink } from "@/components/ui/button";
import { Container, EmptyState } from "@/components/ui/misc";
import { UrlToast } from "@/components/url-toast";
import { formatDayShort } from "@/lib/format";
import { getCurrentUser } from "@/server/auth/current-user";
import { getHomeStats, listParticipants, sampleFirstNames } from "@/server/services/users";

type HomeProps = { searchParams: Promise<{ q?: string; pagina?: string }> };

export default async function HomePage({ searchParams }: HomeProps) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : "";
  const page = Number.parseInt(typeof sp.pagina === "string" ? sp.pagina : "1", 10) || 1;

  const [user, participants, stats, names] = await Promise.all([
    getCurrentUser(),
    listParticipants({ q, page }),
    getHomeStats(),
    sampleFirstNames(6),
  ]);

  return (
    <>
      <Suspense>
        <UrlToast param="saiu" message="Você saiu da sua conta." />
      </Suspense>

      <section className="border-b border-line">
        <Container className="grid gap-10 py-12 sm:py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-20">
          <div>
            <h1 className="max-w-[18ch] animate-rise text-[34px] font-bold leading-[1.05] text-ink sm:text-[56px]">
              Seu Amigo Secreto começa aqui!
            </h1>
            <p className="mt-5 max-w-[34rem] animate-rise text-lg leading-7 text-ink [animation-delay:70ms]">
              Conheça seus amigos, descubra o que eles gostariam de ganhar e participe do sorteio.
            </p>
            <div className="mt-8 flex animate-rise flex-col gap-3 [animation-delay:140ms] sm:flex-row">
              {user ? (
                <>
                  <ButtonLink href="/meus-presentes" size="lg" variant="accent">
                    Montar minha lista
                  </ButtonLink>
                  <ButtonLink href="/meu-resultado" size="lg" variant="outline">
                    Ver quem eu tirei
                  </ButtonLink>
                </>
              ) : (
                <>
                  <ButtonLink href="/cadastro" size="lg" variant="accent">
                    Criar minha conta
                  </ButtonLink>
                  <ButtonLink href="/entrar" size="lg" variant="outline">
                    Já tenho conta
                  </ButtonLink>
                </>
              )}
            </div>

            <dl className="mt-10 grid max-w-lg animate-rise grid-cols-3 divide-x divide-line border-y border-line [animation-delay:210ms]">
              <div className="py-3 pr-4">
                <dt className="text-[13px] text-ink-3">Participantes</dt>
                <dd className="tabular mt-0.5 text-2xl font-medium text-ink">{stats.participants}</dd>
              </div>
              <div className="px-4 py-3">
                <dt className="text-[13px] text-ink-3">Listas prontas</dt>
                <dd className="tabular mt-0.5 text-2xl font-medium text-ink">{stats.listsWithGifts}</dd>
              </div>
              <div className="py-3 pl-4">
                <dt className="text-[13px] text-ink-3">Próxima troca</dt>
                <dd className="mt-0.5 truncate text-2xl font-medium text-ink">
                  {stats.nextDraw?.eventDate ? formatDayShort(stats.nextDraw.eventDate) : <span className="text-ink-3">a definir</span>}
                </dd>
              </div>
            </dl>
          </div>

          <div className="lg:hidden">
            <GiftRow names={names} />
          </div>
          <GiftPile names={names} className="hidden h-[22rem] lg:block" />
        </Container>
      </section>

      <section id="participantes" aria-labelledby="titulo-participantes" className="scroll-mt-20">
        <Container className="py-12 sm:py-16">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="titulo-participantes" className="text-[28px] font-bold text-ink">
                Participantes
              </h2>
              <p className="mt-1 text-base text-ink-2">
                {participants.query
                  ? `${participants.total} ${participants.total === 1 ? "resultado" : "resultados"} para “${participants.query}”`
                  : "Toque em um nome para ver a lista de desejos."}
              </p>
            </div>
            <Suspense>
              <ParticipantSearch initialQuery={q} />
            </Suspense>
          </div>

          {participants.items.length > 0 ? (
            <>
              <ParticipantDirectory people={participants.items} meId={user?.id} />
              <Pagination page={participants.page} pageCount={participants.pageCount} q={participants.query} />
            </>
          ) : participants.query ? (
            <EmptyState
              title="Ninguém com esse nome"
              description="Confira a grafia ou busque só pelo primeiro nome. Acentos não fazem diferença."
            />
          ) : (
            <EmptyState
              title="Ainda não há participantes"
              description="Crie sua conta, monte a lista de desejos e chame a turma."
              action={!user && <ButtonLink href="/cadastro">Criar minha conta</ButtonLink>}
            />
          )}
        </Container>
      </section>
    </>
  );
}
