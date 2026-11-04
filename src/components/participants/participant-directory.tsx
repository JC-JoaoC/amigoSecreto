import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { toSearchText } from "@/lib/text";

type Person = { id: string; name: string; avatarUrl: string | null; giftCount: number };

function groupByLetter(people: Person[]) {
  const groups = new Map<string, Person[]>();
  for (const p of people) {
    const letter = (toSearchText(p.name)[0] ?? "#").toUpperCase();
    const key = /[A-Z]/.test(letter) ? letter : "#";
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  return [...groups.entries()];
}

/** Participantes como uma agenda: agrupados pela inicial, em ordem alfabética. */
export function ParticipantDirectory({ people, meId }: { people: Person[]; meId?: string }) {
  return (
    <div className="gap-x-10 sm:columns-2 lg:columns-3">
      {groupByLetter(people).map(([letter, group]) => (
        <section key={letter} aria-labelledby={`letra-${letter}`} className="mb-6 break-inside-avoid">
          <h3 id={`letra-${letter}`} className="mb-1 border-b border-line pb-1 text-sm font-bold text-ink-3">
            {letter}
          </h3>
          <ul>
            {group.map((p) => (
              <li key={p.id} className="animate-rise">
                <Link
                  href={`/participantes/${p.id}`}
                  className="group -mx-2 flex min-h-14 items-center gap-3 rounded-[var(--radius-control)] px-2 py-2 transition-colors hover:bg-mist"
                >
                  <Avatar name={p.name} seed={p.id} src={p.avatarUrl} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink">
                      {p.name}
                      {p.id === meId && <span className="font-normal text-ink-3"> (você)</span>}
                    </span>
                    <span className="block text-[13px] text-ink-3">
                      {p.giftCount === 0 ? "Lista vazia" : `${p.giftCount} ${p.giftCount === 1 ? "presente" : "presentes"}`}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-0.5 text-sm text-ink-2 group-hover:text-ink">
                    Ver presentes
                    <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
