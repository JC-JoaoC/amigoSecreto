import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { BagStatusBadge } from "@/components/bag/bag-status-badge";
import { NewBagButton } from "@/components/bag/new-bag-button";
import { Container, EmptyState, PageHeader } from "@/components/ui/misc";
import { isOrganizer, requireUser } from "@/server/auth/current-user";
import { listBagDraws } from "@/server/services/bag-draws";

export const metadata: Metadata = { title: "Sorteio do saco" };

const columns = "sm:grid-cols-[minmax(0,1fr)_11rem_6rem_12rem_1rem]";

export default async function BagDrawsPage() {
  const user = await requireUser("/saco");
  const bags = await listBagDraws(user);
  const organizer = isOrganizer(user);

  return (
    <Container className="py-10 sm:py-14">
      <PageHeader
        title="Sorteio do saco"
        description={
          organizer
            ? "Coloque os nomes no saco e tire um por vez. Quem sobrar por último no saco ganha."
            : "Sorteios em que o seu nome está no saco. Quem sobrar por último ganha."
        }
        actions={organizer ? <NewBagButton /> : undefined}
      />

      {bags.length === 0 ? (
        <EmptyState
          title={organizer ? "Nenhum sorteio do saco criado" : "Seu nome ainda não está em nenhum saco"}
          description={
            organizer
              ? "Crie o primeiro e coloque as pessoas cadastradas no saco."
              : "Quando o organizador colocar você em um sorteio do saco, ele aparece aqui."
          }
          action={organizer ? <NewBagButton /> : undefined}
        />
      ) : (
        <div className="rounded-panel border border-line bg-white">
          <div className={`hidden gap-6 border-b border-line px-5 py-2.5 text-[13px] text-ink-3 sm:grid ${columns}`} aria-hidden>
            <span>Sorteio</span>
            <span>Situação</span>
            <span className="text-right">No saco</span>
            <span>Ficou por último</span>
            <span />
          </div>
          <ul className="divide-y divide-line">
            {bags.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/saco/${b.id}`}
                  className={`group grid gap-2 px-5 py-4 transition-colors hover:bg-mist sm:items-center sm:gap-6 ${columns}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink">
                      {b.name}
                      {b.isParticipant && <span className="font-normal text-ink-3"> · seu nome está no saco</span>}
                    </span>
                    {b.description && <span className="block truncate text-[13px] text-ink-3">{b.description}</span>}
                  </span>
                  <span>
                    <BagStatusBadge status={b.status} />
                  </span>
                  <span className="tabular text-[15px] text-ink sm:text-right">
                    {b.entryCount}
                    <span className="text-ink-3 sm:sr-only"> {b.entryCount === 1 ? "nome" : "nomes"}</span>
                  </span>
                  <span className="truncate text-[15px] text-ink-2">
                    {b.winnerName ?? <span className="text-ink-3">—</span>}
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
