import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { DrawStatusBadge } from "@/components/draws/draw-status-badge";
import { OrganizerActions } from "@/components/draws/organizer-actions";
import { ParticipantList } from "@/components/draws/participant-list";
import { ParticipationButton } from "@/components/draws/participation-button";
import { ButtonLink } from "@/components/ui/button";
import { Container, Panel } from "@/components/ui/misc";
import { formatDateTime, formatDay } from "@/lib/format";
import { requireUser } from "@/server/auth/current-user";
import { isAppError } from "@/server/errors";
import { getDraw } from "@/server/services/draws";

export const metadata: Metadata = { title: "Sorteio" };

export default async function DrawPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/sorteios/${id}`);

  let draw;
  try {
    draw = await getDraw(user, id);
  } catch (e) {
    if (isAppError(e) && (e.code === "NOT_FOUND" || e.code === "VALIDATION")) notFound();
    throw e;
  }

  const isOpen = draw.status === "OPEN";
  const count = draw.participants.length;
  const facts = [
    `${count} ${count === 1 ? "participante" : "participantes"}`,
    draw.budget ? `valor sugerido ${draw.budget}` : null,
    draw.eventDate ? `troca em ${formatDay(draw.eventDate)}` : null,
  ].filter(Boolean);

  return (
    <Container className="py-10 sm:py-14">
      <Link href="/sorteios" className="mb-6 inline-flex items-center gap-1 text-[15px] text-ink-2 hover:text-ink">
        <ChevronLeft className="size-4" aria-hidden /> Sorteios
      </Link>

      <header className="mb-10 max-w-3xl">
        <div className="mb-3">
          <DrawStatusBadge status={draw.status} />
        </div>
        <h1 className="break-words text-[28px] font-bold leading-tight text-ink">{draw.name}</h1>
        <p className="mt-1 text-base text-ink-2">{facts.join(" · ")}</p>
        {draw.description && <p className="mt-4 whitespace-pre-line text-base text-ink">{draw.description}</p>}
      </header>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-8">
          {!isOpen && draw.isParticipant && (
            <div className="flex flex-col gap-4 rounded-panel bg-pine-50 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-ink">Seu papel está pronto</h2>
                <p className="mt-0.5 text-[15px] text-ink-2">Só você vê quem tirou. Abra longe de olhares curiosos.</p>
              </div>
              <ButtonLink href={`/meu-resultado?sorteio=${draw.id}`} variant="accent" size="lg">
                Abrir meu papel
              </ButtonLink>
            </div>
          )}

          <section aria-labelledby="titulo-participantes">
            <h2 id="titulo-participantes" className="mb-3 text-xl font-bold text-ink">
              Participantes <span className="tabular font-normal text-ink-3">{count}</span>
            </h2>
            <ParticipantList
              drawId={draw.id}
              participants={draw.participants}
              canRemove={draw.canManage && isOpen}
              currentUserId={user.id}
            />
          </section>
        </div>

        <aside className="space-y-4">
          {isOpen && (
            <Panel className="p-5">
              <h2 className="text-base font-bold text-ink">{draw.isParticipant ? "Você está participando" : "Quer participar?"}</h2>
              <p className="mb-4 mt-1 text-[15px] text-ink-2">
                {draw.isParticipant
                  ? "Quando o organizador sortear, seu papel aparece em “Meu amigo secreto”."
                  : "Entre agora. Você pode sair enquanto o sorteio não acontecer."}
              </p>
              <ParticipationButton drawId={draw.id} isParticipant={draw.isParticipant} />
            </Panel>
          )}

          {draw.canManage && (
            <Panel className="p-5">
              <h2 className="text-base font-bold text-ink">Organização</h2>
              {draw.status === "COMPLETED" ? (
                <dl className="mb-4 mt-2 space-y-1 text-[15px]">
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink-2">Realizado em</dt>
                    <dd className="text-ink">{formatDateTime(draw.completedAt)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink-2">Já abriram o papel</dt>
                    <dd className="tabular text-ink">
                      {draw.revealedCount} de {count}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="mb-4 mt-1 text-[15px] text-ink-2">
                  Adicione quem vai participar e sorteie quando todos estiverem dentro. Depois, os pares ficam visíveis só para
                  organizadores.
                </p>
              )}
              {draw.status === "COMPLETED" && (
                <ButtonLink href={`/sorteios/${draw.id}/admin`} variant="outline" className="mb-2 w-full">
                  Ver pares e mensagens
                </ButtonLink>
              )}
              <OrganizerActions
                draw={{ id: draw.id, name: draw.name, description: draw.description, budget: draw.budget, eventDate: draw.eventDate, status: draw.status }}
                participantCount={count}
              />
            </Panel>
          )}
        </aside>
      </div>
    </Container>
  );
}
