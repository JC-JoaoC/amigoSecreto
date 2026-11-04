"use client";

import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Pilha de presentes do hero: caixas embrulhadas com fita, laço e etiquetas com o primeiro
 * nome (real) de quem participa. Os nomes trocam de presente aleatoriamente a cada poucos segundos.
 */

type Wrap = {
  paper: string;
  /** padrão do papel: bolinhas, listras ou liso */
  pattern?: "dots" | "stripes";
  patternColor?: string;
  ribbon: string;
  knot: string;
};

const WRAPS: Wrap[] = [
  { paper: "#1f5039", pattern: "dots", patternColor: "#2c6a4d", ribbon: "#c9a227", knot: "#a8841f" },
  { paper: "#b8232f", ribbon: "#e8c45a", knot: "#c9a227" },
  { paper: "#d6b483", pattern: "stripes", patternColor: "#cfa972", ribbon: "#b8232f", knot: "#9a1d29" },
  { paper: "#e8d38a", ribbon: "#1f5039", knot: "#0f2a1f" },
  { paper: "#f3d6d8", pattern: "dots", patternColor: "#ecc3c6", ribbon: "#b8232f", knot: "#9a1d29" },
  { paper: "#0f2a1f", ribbon: "#b8232f", knot: "#9a1d29" },
];

function paperStyle(w: Wrap): CSSProperties {
  if (w.pattern === "dots") {
    return {
      backgroundColor: w.paper,
      backgroundImage: `radial-gradient(${w.patternColor} 18%, transparent 19%)`,
      backgroundSize: "14px 14px",
    };
  }
  if (w.pattern === "stripes") {
    return {
      backgroundColor: w.paper,
      backgroundImage: `repeating-linear-gradient(135deg, ${w.patternColor} 0 6px, transparent 6px 14px)`,
    };
  }
  return { backgroundColor: w.paper };
}

// ───────────────────────────── Nomes trocando de presente ─────────────────────────────

const ROTATE_MS = 2600;
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

type TagState = { names: (string | null)[]; versions: number[] };

/**
 * Distribui os nomes pelos presentes e, a cada poucos segundos, muda uma etiqueta:
 *  - se há participantes ainda não mostrados, um deles entra no lugar de um nome visível;
 *  - senão, se sobra presente vazio, um nome pula para ele;
 *  - senão, dois presentes trocam de nome.
 * A posição inicial é fixa (igual no servidor e no navegador); o sorteio começa depois de carregar.
 * Fica parado com "movimento reduzido", com a aba escondida ou com o mouse em cima.
 */
function useRotatingNames(rawNames: string[], slots: number, firstSlots: number[]) {
  const names = useMemo(() => [...new Set(rawNames.filter(Boolean))], [rawNames]);
  const [state, setState] = useState<TagState>(() => {
    const initial: (string | null)[] = Array(slots).fill(null);
    names.slice(0, slots).forEach((name, i) => {
      initial[firstSlots[i] ?? i] = name;
    });
    return { names: initial, versions: Array(slots).fill(0) };
  });
  const paused = useRef(false);

  useEffect(() => {
    if (names.length === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const id = window.setInterval(() => {
      if (paused.current || document.visibilityState !== "visible") return;
      setState((prev) => {
        const next = [...prev.names];
        const versions = [...prev.versions];
        const filled = next.flatMap((n, i) => (n ? [i] : []));
        const empty = next.flatMap((n, i) => (n ? [] : [i]));
        const shown = new Set(next.filter(Boolean));
        const hidden = names.filter((n) => !shown.has(n));

        if (hidden.length > 0 && filled.length > 0) {
          const slot = pick(filled);
          next[slot] = pick(hidden);
          versions[slot]++;
        } else if (empty.length > 0 && filled.length > 0) {
          const from = pick(filled);
          const to = pick(empty);
          next[to] = next[from];
          next[from] = null;
          versions[to]++;
        } else if (filled.length > 1) {
          const a = pick(filled);
          const b = pick(filled.filter((i) => i !== a));
          [next[a], next[b]] = [next[b], next[a]];
          versions[a]++;
          versions[b]++;
        } else {
          return prev;
        }
        return { names: next, versions };
      });
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [names]);

  const setPaused = useCallback((value: boolean) => {
    paused.current = value;
  }, []);

  return { ...state, setPaused };
}

function NameTag({ name, className, style }: { name: string; className?: string; style?: CSSProperties }) {
  return (
    <div
      className={cn(
        "flex w-max max-w-[11rem] animate-tag items-center gap-1.5 rounded-[3px] border border-paper-edge bg-paper py-0.5 pl-1.5 pr-2.5",
        className,
      )}
      style={style}
    >
      <span className="size-1.5 shrink-0 rounded-full border border-paper-edge bg-white" />
      <span className="truncate whitespace-nowrap font-hand text-[22px] leading-tight text-ink">{name}</span>
    </div>
  );
}

// ───────────────────────────── Caixa de presente ─────────────────────────────

type BoxProps = {
  wrap: Wrap;
  /** Etiqueta dentro da própria caixa (usada na fileira do celular). */
  name?: string | null;
  tagKey?: string;
  className?: string;
  style?: CSSProperties;
  delay?: number;
};

/** Uma caixa de presente: tampa, corpo, fita em cruz e laço. */
export function GiftBox({ wrap, name, tagKey, className, style, delay = 0 }: BoxProps) {
  return (
    <div className={cn("animate-drop", className)} style={{ ...style, animationDelay: `${delay}ms` }}>
      <div className="relative h-full w-full transition-transform duration-200 hover:-translate-y-1">
        {/* laço */}
        <svg viewBox="0 0 64 30" className="absolute bottom-[calc(100%-6px)] left-1/2 z-10 w-[42%] min-w-10 -translate-x-1/2" aria-hidden>
          <path d="M32 26C20 3 3 2 6 15c2.5 10 15 11 26 11Z" fill={wrap.ribbon} />
          <path d="M32 26C44 3 61 2 58 15c-2.5 10-15 11-26 11Z" fill={wrap.ribbon} />
          <path d="M32 26C22 10 11 9 12 16c1 5 9 8 20 10Z" fill={wrap.knot} opacity="0.35" />
          <path d="M32 26C42 10 53 9 52 16c-1 5-9 8-20 10Z" fill={wrap.knot} opacity="0.35" />
          <rect x="27" y="20" width="10" height="9" rx="3" fill={wrap.knot} />
        </svg>

        {/* corpo */}
        <div className="absolute inset-x-[4%] bottom-0 top-[20%] overflow-hidden rounded-b-[3px]" style={paperStyle(wrap)}>
          <span className="absolute inset-y-0 left-1/2 w-[13%] -translate-x-1/2" style={{ background: wrap.ribbon }} />
          <span className="absolute inset-x-0 top-[42%] h-[11%]" style={{ background: wrap.ribbon }} />
        </div>

        {/* tampa */}
        <div className="absolute inset-x-0 top-0 h-[24%] overflow-hidden rounded-[3px]" style={paperStyle(wrap)}>
          <span className="absolute inset-y-0 left-1/2 w-[12%] -translate-x-1/2" style={{ background: wrap.ribbon }} />
          <span className="absolute inset-x-0 bottom-0 h-[3px] bg-black/15" />
        </div>

        {name && <NameTag key={tagKey} name={name} className="absolute bottom-[12%] right-[6%] z-20 max-w-[82%] -rotate-6" />}
      </div>
    </div>
  );
}

// ───────────────────────────── Pilha (desktop) ─────────────────────────────

/** Posições da pilha em % do contêiner: fileira de trás primeiro, depois a da frente. */
const PILE = [
  { left: 40, bottom: 68, width: 18, height: 19, row: "back" as const },
  { left: 14, bottom: 38, width: 30, height: 34, row: "back" as const },
  { left: 54, bottom: 41, width: 27, height: 30, row: "back" as const },
  { left: 0, bottom: 0, width: 35, height: 44, row: "front" as const },
  { left: 35, bottom: 0, width: 28, height: 33, row: "front" as const },
  { left: 64, bottom: 0, width: 34, height: 50, row: "front" as const },
];
const PILE_WRAPS = [5, 3, 4, 0, 1, 2];
/** Com poucos participantes, os nomes começam pela fileira da frente. */
const PILE_FIRST_SLOTS = [3, 4, 5, 1, 2, 0];

/** Onde fica a etiqueta de cada caixa (em % do contêiner). */
function tagPosition(spot: (typeof PILE)[number]): CSSProperties {
  return spot.row === "front"
    ? { left: `${spot.left + spot.width * 0.38}%`, bottom: `${spot.bottom + spot.height * 0.1}%` }
    : { left: `${spot.left + spot.width * 0.52}%`, bottom: `${spot.bottom + spot.height * 0.42}%` };
}

export function GiftPile({ names, className }: { names: string[]; className?: string }) {
  const tags = useRotatingNames(names, PILE.length, PILE_FIRST_SLOTS);
  return (
    <div
      className={cn("relative", className)}
      aria-hidden
      onMouseEnter={() => tags.setPaused(true)}
      onMouseLeave={() => tags.setPaused(false)}
    >
      {PILE.map((spot, i) => (
        <GiftBox
          key={i}
          wrap={WRAPS[PILE_WRAPS[i]]}
          className="absolute"
          style={{ left: `${spot.left}%`, bottom: `${spot.bottom}%`, width: `${spot.width}%`, height: `${spot.height}%` }}
          delay={120 + i * 80}
        />
      ))}
      {/* Etiquetas numa camada própria: nenhuma caixa cobre ou corta um nome. */}
      {PILE.map((spot, i) => {
        const name = tags.names[i];
        if (!name) return null;
        return (
          <NameTag
            key={`${i}-${tags.versions[i]}`}
            name={name}
            className={cn("absolute z-30", spot.row === "front" ? "-rotate-6" : "rotate-3")}
            style={tagPosition(spot)}
          />
        );
      })}
    </div>
  );
}

/** Versão do celular: três presentes lado a lado, de alturas diferentes. */
export function GiftRow({ names }: { names: string[] }) {
  // Proporções (não alturas fixas): a caixa mantém o formato em qualquer largura.
  const sizes = ["aspect-[1/0.85]", "aspect-[1/0.7]", "aspect-square"];
  const tags = useRotatingNames(names, 3, [0, 1, 2]);
  return (
    <div className="grid grid-cols-3 items-end gap-4 pt-8" aria-hidden>
      {[0, 1, 2].map((i) => (
        <GiftBox
          key={i}
          wrap={WRAPS[i]}
          name={tags.names[i]}
          tagKey={`${i}-${tags.versions[i]}`}
          className={sizes[i]}
          delay={100 + i * 70}
        />
      ))}
    </div>
  );
}
