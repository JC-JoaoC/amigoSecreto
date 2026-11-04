"use client";

import { useRouter } from "next/navigation";
import { type KeyboardEvent, useEffect, useId, useRef, useState, useTransition } from "react";
import { markConversationReadAction, sendMessageAction } from "@/app/actions/messages";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";

export type ChatMessage = { id: string; mine: boolean; body: string; time: string };
type Thread = { messages: ChatMessage[]; unread: number } | null;
type Side = "receiver" | "secret-friend";

const MAX = 1000;

const TABS: { side: Side; label: string; help: string; empty: string }[] = [
  {
    side: "receiver",
    label: "Quem eu tirei",
    help: "A pessoa não sabe que é você. Pergunte tamanho, cor, o que ela já tem…",
    empty: "Nenhuma mensagem ainda. Que tal perguntar algo que ajude a escolher o presente?",
  },
  {
    side: "secret-friend",
    label: "Quem me tirou",
    help: "Quem te tirou fala com você por aqui. Você responde sem saber quem é.",
    empty: "Seu amigo secreto ainda não escreveu. Você pode mandar uma dica primeiro.",
  },
];

/** Conversas anônimas do par do sorteio, em duas abas. */
export function Conversations({ drawId, withReceiver, withSecretFriend }: { drawId: string; withReceiver: Thread; withSecretFriend: Thread }) {
  const router = useRouter();
  const baseId = useId();
  const threads: Record<Side, Thread> = { receiver: withReceiver, "secret-friend": withSecretFriend };
  const available = TABS.filter((t) => threads[t.side]);
  const [active, setActive] = useState<Side>(
    withSecretFriend && withSecretFriend.unread > 0 ? "secret-friend" : (available[0]?.side ?? "receiver"),
  );
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const current = threads[active];
  const tab = TABS.find((t) => t.side === active)!;

  // Mensagens novas chegam sem recarregar a página (a cada 20 s, só com a aba visível).
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 20_000);
    return () => clearInterval(t);
  }, [router]);

  // Abrir a aba marca as mensagens recebidas como lidas, uma única vez por conversa/estado
  // (o modo estrito do React roda efeitos duas vezes em desenvolvimento).
  const unreadHere = current?.unread ?? 0;
  const markedRef = useRef<string | null>(null);
  useEffect(() => {
    const key = `${active}:${unreadHere}`;
    if (unreadHere > 0 && markedRef.current !== key) {
      markedRef.current = key;
      void markConversationReadAction(drawId, active);
    }
  }, [drawId, active, unreadHere]);

  function onTabKey(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = available[(index + (e.key === "ArrowRight" ? 1 : available.length - 1)) % available.length];
    setActive(next.side);
    tabRefs.current[next.side]?.focus();
  }

  if (available.length === 0) return null;

  return (
    <div>
      <div role="tablist" aria-label="Mensagens anônimas" className="grid w-full grid-cols-2 rounded-control bg-mist p-1 sm:inline-grid sm:w-auto">
        {available.map((t, i) => {
          const selected = t.side === active;
          const unread = threads[t.side]?.unread ?? 0;
          return (
            <button
              key={t.side}
              ref={(el) => {
                tabRefs.current[t.side] = el;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${t.side}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(t.side)}
              onKeyDown={(e) => onTabKey(e, i)}
              className={cn(
                "inline-flex min-h-9 items-center justify-center whitespace-nowrap rounded-[5px] px-3 text-[15px] transition-colors",
                selected ? "bg-white font-medium text-ink shadow-[0_0_0_1px_var(--color-line)]" : "text-ink-2 hover:text-ink",
              )}
            >
              {t.label}
              {unread > 0 && !selected && (
                <span className="tabular ml-2 inline-grid h-5 min-w-5 place-items-center rounded-full bg-berry-600 px-1.5 text-xs text-white">
                  {unread}
                  <span className="sr-only"> não lidas</span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`${baseId}-panel`} aria-labelledby={`${baseId}-tab-${active}`} className="mt-4">
        <p className="text-[15px] text-ink-2">{tab.help}</p>
        <MessageList messages={current?.messages ?? []} empty={tab.empty} />
        <Composer key={active} drawId={drawId} side={active} />
      </div>
    </div>
  );
}

function MessageList({ messages, empty }: { messages: ChatMessage[]; empty: string }) {
  const endRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  if (messages.length === 0) {
    return <p className="mt-4 rounded-panel border border-dashed border-line-strong px-4 py-4 text-[15px] text-ink-2">{empty}</p>;
  }
  return (
    <ul className="mt-4 max-h-80 space-y-3 overflow-y-auto overscroll-contain pr-1" aria-label="Mensagens">
      {messages.map((m) => (
        <li key={m.id} className={cn("flex flex-col", m.mine ? "items-end" : "items-start")}>
          <span className="sr-only">{m.mine ? "Você:" : "Anônimo:"}</span>
          <p
            className={cn(
              "max-w-[85%] whitespace-pre-line break-words rounded-panel px-3.5 py-2 text-[15px] leading-6",
              m.mine ? "bg-pine-900 text-white" : "bg-mist text-ink",
            )}
          >
            {m.body}
          </p>
          <span className="mt-1 text-xs text-ink-3">{m.time}</span>
        </li>
      ))}
      <li ref={endRef} aria-hidden />
    </ul>
  );
}

function Composer({ drawId, side }: { drawId: string; side: Side }) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fieldId = useId();

  function send() {
    const body = text.trim();
    if (!body) {
      setError("Escreva uma mensagem.");
      return;
    }
    startTransition(async () => {
      const r = await sendMessageAction(drawId, side, body);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setText("");
      setError(null);
      toast.success("Mensagem enviada anonimamente.");
    });
  }

  return (
    <form
      noValidate
      className="mt-4"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <label htmlFor={fieldId} className="sr-only">
        {side === "receiver" ? "Mensagem para quem você tirou" : "Mensagem para o seu amigo secreto"}
      </label>
      <textarea
        id={fieldId}
        name="message"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            send();
          }
        }}
        rows={2}
        maxLength={MAX}
        autoComplete="off"
        placeholder={side === "receiver" ? "Escreva sem se identificar…" : "Responda ao seu amigo secreto…"}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={`${fieldId}-meta`}
        className={cn(
          "w-full resize-y rounded-control border bg-white px-3 py-2.5 text-[16px] leading-6 text-ink placeholder:text-ink-3/80",
          "focus:border-pine-700 focus:outline-none focus:ring-2 focus:ring-gold-300",
          error ? "border-berry-600" : "border-line-strong",
        )}
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <p id={`${fieldId}-meta`} className={cn("text-[13px]", error ? "text-berry-700" : "text-ink-3")} aria-live="polite">
          {error ?? `${text.length}/${MAX} · Ctrl+Enter envia`}
        </p>
        <Button type="submit" size="sm" loading={pending}>
          {pending ? "Enviando…" : "Enviar anônimo"}
        </Button>
      </div>
    </form>
  );
}
