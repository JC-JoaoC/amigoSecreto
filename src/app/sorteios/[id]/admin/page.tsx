import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ChevronDown, ChevronLeft, EyeOff } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Container, EmptyState, PageHeader, Panel, StatusPill } from "@/components/ui/misc";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { isOrganizer, requireUser } from "@/server/auth/current-user";
import { isAppError } from "@/server/errors";
import { type AuditPair, getDrawAudit } from "@/server/services/admin";

export const metadata: Metadata = { title: "Pares e mensagens", robots: { index: false, follow: false } };

export default async function DrawAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/sorteios/${id}/admin`);
  if (!isOrganizer(user)) notFound();

  let audit;
  try {
    audit = await getDrawAudit(user, id);
  } catch (e) {
    if (isAppError(e) && (e.code === "NOT_FOUND" || e.code === "VALIDATION" || e.code === "FORBIDDEN")) notFound();
    throw e;
  }

  const { draw, pairs, isParticipant } = audit;
  const revealed = pairs.filter((p) => p.revealedAt).length;
  const messageCount = pairs.reduce((n, p) => n + p.messages.length, 0);

  return (
    <Container className="max-w-4xl py-10 sm:py-14">
      <Link href={`/sorteios/${draw.id}`} className="mb-6 inline-flex items-center gap-1 text-[15px] text-ink-2 hover:text-ink">
        <ChevronLeft className="size-4" aria-hidden /> {draw.name}
      </Link>

      <PageHeader
        title="Pares e mensagens"
        description="Área do organizador: quem tirou quem e as conversas anônimas de cada par. Os participantes não veem esta página."
      />

      {draw.status !== "COMPLETED" ? (
        <EmptyState
          title="O sorteio ainda não foi realizado"
          description="Os pares e as mensagens aparecem aqui depois do sorteio."
        />
      ) : (
        <details className="group">
          <summary className="flex cursor-pointer list-none flex-col gap-3 rounded-panel border border-line bg-white px-5 py-4 hover:bg-mist sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden">
            <div className="flex items-start gap-3">
              <EyeOff className="mt-0.5 size-5 shrink-0 text-ink-2" aria-hidden />
              <div>
                <p className="font-medium text-ink">Mostrar pares e mensagens</p>
                <p className="mt-0.5 text-[15px] text-ink-2">
                  {isParticipant
                    ? "Você também participa: abrir revela quem te tirou. "
                    : "Abra longe de olhares curiosos. "}
                  <span className="tabular">
                    {pairs.length} pares · {revealed} {revealed === 1 ? "abriu" : "abriram"} o papel · {messageCount}{" "}
                    {messageCount === 1 ? "mensagem" : "mensagens"}
                  </span>
                </p>
              </div>
            </div>
            <ChevronDown className="size-5 shrink-0 text-ink-2 transition-transform group-open:rotate-180" aria-hidden />
          </summary>

          <ul className="mt-4 space-y-3" aria-label="Pares do sorteio">
            {pairs.map((pair) => (
              <PairItem key={pair.resultId} pair={pair} />
            ))}
          </ul>
        </details>
      )}
    </Container>
  );
}

function PairItem({ pair }: { pair: AuditPair }) {
  const receiverName = pair.receiver?.name ?? "Não foi possível identificar";
  return (
    <li>
      <Panel as="div" className="px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
            <Person name={pair.giver.name} seed={pair.giver.id} src={pair.giver.avatarUrl} />
            <ArrowRight className="size-4 shrink-0 text-ink-3" aria-label="tirou" />
            {pair.receiver ? (
              <Person name={pair.receiver.name} seed={pair.receiver.id} src={pair.receiver.avatarUrl} />
            ) : (
              <span className="text-[15px] text-ink-2">{receiverName}</span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {pair.revealedAt ? (
              <StatusPill tone="positive">abriu o papel</StatusPill>
            ) : (
              <StatusPill tone="attention">não abriu</StatusPill>
            )}
            <StatusPill>
              {pair.messages.length} {pair.messages.length === 1 ? "mensagem" : "mensagens"}
            </StatusPill>
          </div>
        </div>

        {pair.messages.length > 0 && (
          <details className="group/chat mt-3 border-t border-line pt-3">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-[15px] font-medium text-ink-2 hover:text-ink [&::-webkit-details-marker]:hidden">
              Ver conversa
              <ChevronDown className="size-4 transition-transform group-open/chat:rotate-180" aria-hidden />
            </summary>
            <ol className="mt-3 space-y-3" aria-label={`Conversa entre ${pair.giver.name} e ${receiverName}`}>
              {pair.messages.map((m) => {
                const fromGiver = m.from === "giver";
                const author = fromGiver ? pair.giver.name : receiverName;
                return (
                  <li key={m.id} className={cn("flex flex-col", fromGiver ? "items-start" : "items-end")}>
                    <span className="mb-1 text-xs text-ink-3">
                      {author} {fromGiver ? "(amigo secreto)" : "(sorteado)"} · {formatDateTime(m.createdAt)}
                      {m.readAt ? " · lida" : ""}
                    </span>
                    <p
                      className={cn(
                        "max-w-[85%] whitespace-pre-line break-words rounded-panel px-3.5 py-2 text-[15px] leading-6",
                        fromGiver ? "bg-mist text-ink" : "bg-pine-900 text-white",
                        m.body === null && "italic opacity-70",
                      )}
                    >
                      {m.body ?? "Mensagem ilegível (chave da aplicação trocada)."}
                    </p>
                  </li>
                );
              })}
            </ol>
          </details>
        )}
      </Panel>
    </li>
  );
}

function Person({ name, seed, src }: { name: string; seed: string; src: string | null }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <Avatar name={name} seed={seed} src={src} size="sm" />
      <span className="truncate text-[15px] font-medium text-ink">{name}</span>
    </span>
  );
}
