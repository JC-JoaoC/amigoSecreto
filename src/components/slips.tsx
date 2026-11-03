import { cn } from "@/lib/cn";

/**
 * Papeizinhos do sorteio com nomes reais da turma — o elemento de assinatura do produto.
 * Posições fixas (sem aleatoriedade no cliente, evita diferença de hidratação).
 */
const SPOTS = [
  { x: "4%", y: "8%", tilt: "-7deg" },
  { x: "46%", y: "2%", tilt: "5deg" },
  { x: "22%", y: "30%", tilt: "3deg" },
  { x: "60%", y: "30%", tilt: "-4deg" },
  { x: "2%", y: "54%", tilt: "6deg" },
  { x: "40%", y: "58%", tilt: "-8deg" },
  { x: "66%", y: "60%", tilt: "4deg" },
];

export function SlipPile({ names, className }: { names: string[]; className?: string }) {
  const items = names.length > 0 ? names.slice(0, SPOTS.length) : ["", "", ""];
  return (
    <div className={cn("relative", className)} aria-hidden>
      {items.map((name, i) => {
        const spot = SPOTS[i];
        return (
          <div
            key={`${name}-${i}`}
            className="absolute w-[44%] max-w-48 animate-drop"
            style={{ left: spot.x, top: spot.y, ["--tilt" as string]: spot.tilt, animationDelay: `${120 + i * 75}ms` }}
          >
            <div className="slip flex h-16 items-center justify-center px-4 transition-transform duration-200 hover:-translate-y-1">
              <span className="truncate font-hand text-[28px] leading-none text-ink">{name}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Versão em linha para o celular. */
export function SlipRow({ names }: { names: string[] }) {
  const items = (names.length > 0 ? names : ["", "", ""]).slice(0, 3);
  const tilts = ["-4deg", "3deg", "-2deg"];
  return (
    <div className="grid grid-cols-3 gap-3" aria-hidden>
      {items.map((name, i) => (
        <div
          key={`${name}-${i}`}
          className="slip flex h-12 min-w-0 animate-drop items-center justify-center overflow-hidden px-2"
          style={{ ["--tilt" as string]: tilts[i], animationDelay: `${100 + i * 70}ms` }}
        >
          <span className="truncate font-hand text-2xl leading-none text-ink">{name}</span>
        </div>
      ))}
    </div>
  );
}
