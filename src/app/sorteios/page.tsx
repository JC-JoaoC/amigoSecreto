import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { DrawStatusBadge } from "@/components/draws/draw-status-badge";
import { NewDrawButton } from "@/components/draws/new-draw-button";
import { Container, EmptyState, PageHeader } from "@/components/ui/misc";
import { formatDayShort } from "@/lib/format";
import { isOrganizer, requireUser } from "@/server/auth/current-user";
import { listDraws } from "@/server/services/draws";

export const metadata: Metadata = { title: "Sorteios" };

const columns = "sm:grid-cols-[minmax(0,1fr)_11rem_7rem_6rem_1rem]";

export default async function DrawsPage() {
  const user = await requireUser("/sorteios");
  const draws = await listDraws(user);
  const organizer = isOrganizer(user);

  return (
    <Container className="py-10 sm:py-14">
      <PageHeader
        title="Sorteios"
        description={
          organizer
            ? "Crie o sorteio, escolha quem participa e sorteie quando a turma estiver completa."
            : "Entre nos sorteios abertos. Quando o organizador sortear, você abre o seu papel."
        }
        actions={organizer ? <NewDrawButton /> : undefined}
      />

      {draws.length === 0 ? (
        <EmptyState
          title={organizer ? "Nenhum sorteio criado" : "Nenhum sorteio aberto agora"}
          description={
            organizer
              ? "Crie o primeiro e adicione as pessoas cadastradas."
              : "Quando o organizador criar um sorteio, ele aparece aqui. Enquanto isso, capriche na sua lista."
          }
          action={organizer ? <NewDrawButton /> : undefined}
        />
      ) : (
        <div className="rounded-panel border border-line bg-white">
          <div className={`hidden gap-6 border-b border-line px-5 py-2.5 text-[13px] text-ink-3 sm:grid ${columns}`} aria-hidden>
            <span>Sorteio</span>
            <span>Situação</span>
            <span className="text-right">Participantes</span>
            <span>Troca</span>
            <span />
          </div>
          <ul className="divide-y divide-line">
            {draws.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/sorteios/${d.id}`}
                  className={`group grid gap-2 px-5 py-4 transition-colors hover:bg-mist sm:items-center sm:gap-6 ${columns}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink">
                      {d.name}
                      {d.isParticipant && <span className="font-normal text-ink-3"> · você participa</span>}
                    </span>
                    {d.description && <span className="block truncate text-[13px] text-ink-3">{d.description}</span>}
                  </span>
                  <span>
                    <DrawStatusBadge status={d.status} />
                  </span>
                  <span className="tabular text-[15px] text-ink sm:text-right">
                    {d.participantCount}
                    <span className="text-ink-3 sm:sr-only"> {d.participantCount === 1 ? "participante" : "participantes"}</span>
                  </span>
                  <span className="text-[15px] text-ink-2">
                    {d.eventDate ? formatDayShort(d.eventDate) : <span className="text-ink-3">—</span>}
                  </span>
                  <ChevronRight className="hidden size-4 text-ink-3 transition-transform group-hover:translate-x-0.5 sm:block" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Container>
  );
}
