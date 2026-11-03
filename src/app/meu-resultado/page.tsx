import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { type ChatMessage, Conversations } from "@/components/result/conversations";
import { RevealSlip } from "@/components/result/reveal-slip";
import { ButtonLink } from "@/components/ui/button";
import { Container, EmptyState, PageHeader, Panel } from "@/components/ui/misc";
import { formatDateTime, formatDay, formatDayShort } from "@/lib/format";
import { requireUser } from "@/server/auth/current-user";
import { listMyParticipations } from "@/server/services/draws";
import { type Conversation, getConversations } from "@/server/services/messages";

export const metadata: Metadata = { title: "Meu amigo secreto" };

function toChat(c: Conversation | null) {
  if (!c) return null;
  return {
    unread: c.unread,
    messages: c.messages.map<ChatMessage>((m) => ({ id: m.id, mine: m.mine, body: m.body, time: formatDateTime(m.createdAt) ?? "" })),
  };
}

export default async function MyResultPage({ searchParams }: { searchParams: Promise<{ sorteio?: string }> }) {
  const user = await requireUser("/meu-resultado");
  const [draws, sp] = await Promise.all([listMyParticipations(user), searchParams]);

  // O sorteio indicado na URL (ex.: link do e-mail) vem primeiro.
  const focus = typeof sp.sorteio === "string" ? sp.sorteio : null;
  const ordered = focus ? [...draws].sort((a, b) => Number(b.id === focus) - Number(a.id === focus)) : draws;
  const completed = ordered.filter((d) => d.status === "COMPLETED");
  const waiting = ordered.filter((d) => d.status === "OPEN");

  const conversations = await Promise.all(
    completed.map((d) => getConversations(user, d.id).catch(() => ({ withReceiver: null, withSecretFriend: null }))),
  );

  return (
    <Container className="py-10 sm:py-14">
      <PageHeader
        title="Meu amigo secreto"
        description="Abra o seu papel para ver quem você tirou e converse com o seu par sem revelar quem é."
      />

      {draws.length === 0 ? (
        <EmptyState
          title="Você ainda não está em nenhum sorteio"
          description="Entre num sorteio aberto ou peça para o organizador te adicionar."
          action={<ButtonLink href="/sorteios">Ver sorteios</ButtonLink>}
        />
      ) : (
        <div className="space-y-10">
          {completed.map((d, i) => {
            const facts = [d.budget ? `valor sugerido ${d.budget}` : null, d.eventDate ? `troca em ${formatDay(d.eventDate)}` : null].filter(Boolean);
            const conv = conversations[i];
            return (
              <Panel key={d.id} className="p-5 sm:p-8" aria-labelledby={`sorteio-${d.id}`}>
                <h2 id={`sorteio-${d.id}`} className="text-xl font-bold text-ink">
                  {d.name}
                </h2>
                {facts.length > 0 && <p className="mt-0.5 text-[15px] text-ink-2">{facts.join(" · ")}</p>}
                <div className="mt-6 grid gap-10 lg:grid-cols-[20rem_minmax(0,1fr)]">
                  <RevealSlip drawId={d.id} alreadyRevealed={d.revealed} />
                  <section aria-label="Mensagens anônimas" className="min-w-0 lg:border-l lg:border-line lg:pl-10">
                    <Conversations drawId={d.id} withReceiver={toChat(conv.withReceiver)} withSecretFriend={toChat(conv.withSecretFriend)} />
                  </section>
                </div>
              </Panel>
            );
          })}

          {waiting.length > 0 && (
            <section aria-labelledby="aguardando">
              <h2 id="aguardando" className="mb-3 text-xl font-bold text-ink">
                Aguardando o sorteio
              </h2>
              <ul className="divide-y divide-line rounded-panel border border-line bg-white">
                {waiting.map((d) => (
                  <li key={d.id}>
                    <Link href={`/sorteios/${d.id}`} className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-mist">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-ink">{d.name}</span>
                        <span className="block text-[13px] text-ink-3">
                          {d.eventDate ? `Troca em ${formatDayShort(d.eventDate)}` : "O organizador ainda vai sortear"}
                        </span>
                      </span>
                      <ChevronRight className="size-4 text-ink-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Container>
  );
}
