import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { BagOrganizerActions } from "@/components/bag/bag-organizer-actions";
import { BagStage } from "@/components/bag/bag-stage";
import { BagStatusBadge } from "@/components/bag/bag-status-badge";
import { ParticipantList } from "@/components/draws/participant-list";
import { Container, Panel } from "@/components/ui/misc";
import { formatDateTime } from "@/lib/format";
import { requireUser } from "@/server/auth/current-user";
import { isAppError } from "@/server/errors";
import { getBagDraw } from "@/server/services/bag-draws";

export const metadata: Metadata = { title: "Sorteio do saco" };

export default async function BagDrawPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/saco/${id}`);

  let bag;
  try {
    bag = await getBagDraw(user, id);
  } catch (e) {
    if (isAppError(e) && (e.code === "NOT_FOUND" || e.code === "VALIDATION")) notFound();
    throw e;
  }

  const isOpen = bag.status === "OPEN";
  const facts = [
    `${bag.total} ${bag.total === 1 ? "nome" : "nomes"} no sorteio`,
    bag.status === "COMPLETED" && bag.completedAt ? `concluído em ${formatDateTime(bag.completedAt)}` : null,
  ].filter(Boolean);

  return (
    <Container className="py-10 sm:py-14">
      <Link href="/saco" className="mb-6 inline-flex items-center gap-1 text-[15px] text-ink-2 hover:text-ink">
        <ChevronLeft className="size-4" aria-hidden /> Sorteio do saco
      </Link>

      <header className="mb-10 max-w-3xl">
        <div className="mb-3">
          <BagStatusBadge status={bag.status} />
        </div>
        <h1 className="break-words text-[28px] font-bold leading-tight text-ink">{bag.name}</h1>
        <p className="mt-1 text-base text-ink-2">{facts.join(" · ")}</p>
        {bag.description && <p className="mt-4 whitespace-pre-line text-base text-ink">{bag.description}</p>}
      </header>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-8">
          <BagStage
            bagId={bag.id}
            status={bag.status}
            canDraw={bag.canManage}
            inBagCount={bag.inBag.length}
            drawn={bag.drawn}
            winner={bag.winner}
          />

          {bag.status !== "COMPLETED" && (
            <section aria-labelledby="titulo-no-saco">
              <h2 id="titulo-no-saco" className="mb-3 text-xl font-bold text-ink">
                {isOpen ? "No saco" : "Ainda no saco"} <span className="tabular font-normal text-ink-3">{bag.inBag.length}</span>
              </h2>
              <ParticipantList
                kind="bag"
                drawId={bag.id}
                participants={bag.inBag}
                canRemove={bag.canManage && isOpen}
                currentUserId={user.id}
              />
            </section>
          )}
        </div>

        <aside className="space-y-4">
          {bag.canManage ? (
            <Panel className="p-5">
              <h2 className="text-base font-bold text-ink">Organização</h2>
              <p className="mb-4 mt-1 text-[15px] text-ink-2">
                {isOpen
                  ? "Coloque as pessoas no saco. Na hora, tire um nome por vez: quem sobrar por último ganha."
                  : bag.status === "RUNNING"
                    ? "O sorteio começou. Ninguém entra nem sai do saco até o fim."
                    : "Sorteio concluído. A ordem de saída fica registrada aqui."}
              </p>
              <BagOrganizerActions
                bag={{ id: bag.id, name: bag.name, description: bag.description, status: bag.status }}
                inBag={isOpen ? bag.inBag : []}
                lastUserId={isOpen ? bag.lastUserId : null}
              />
            </Panel>
          ) : (
            <Panel className="p-5">
              <h2 className="text-base font-bold text-ink">Seu nome está no saco</h2>
              <p className="mt-1 text-[15px] text-ink-2">
                {bag.status === "COMPLETED"
                  ? "O sorteio terminou. Veja quem ficou por último."
                  : "O organizador tira um nome por vez. Esta tela se atualiza sozinha."}
              </p>
            </Panel>
          )}
        </aside>
      </div>
    </Container>
  );
}
