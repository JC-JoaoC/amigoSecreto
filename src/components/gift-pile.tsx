import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";

/**
 * Pilha de presentes do hero: caixas embrulhadas com fita, laço e etiqueta
 * com o primeiro nome (real) de quem participa. Cores chapadas, sem gradiente de efeito.
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

type BoxProps = {
  name?: string;
  wrap: Wrap;
  tag?: "bottom" | "top";
  className?: string;
  style?: CSSProperties;
  delay?: number;
};

/** Uma caixa de presente: tampa, corpo, fita em cruz, laço e etiqueta. */
export function GiftBox({ name, wrap, tag = "bottom", className, style, delay = 0 }: BoxProps) {
  return (
    <div className={cn("animate-drop", className)} style={{ ...style, animationDelay: `${delay}ms` }}>
      <div className="group relative h-full w-full transition-transform duration-200 hover:-translate-y-1">
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

        {/* etiqueta com o nome */}
        {name && (
          <div
            className={cn(
              "absolute z-20 flex max-w-[82%] items-center gap-1.5 rounded-[3px] border border-paper-edge bg-paper py-0.5 pl-1.5 pr-2.5",
              tag === "bottom" ? "bottom-[12%] right-[6%] -rotate-6" : "right-[-6%] top-[30%] rotate-3",
            )}
          >
            <span className="size-1.5 shrink-0 rounded-full border border-paper-edge bg-white" />
            <span className="truncate font-hand text-[22px] leading-tight text-ink">{name}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Posições da pilha (fileira de trás primeiro, depois a da frente). Medidas em % do contêiner. */
const PILE = [
  { left: "40%", bottom: "68%", width: "18%", height: "19%", tag: "top" as const },
  { left: "14%", bottom: "38%", width: "30%", height: "34%", tag: "top" as const },
  { left: "54%", bottom: "41%", width: "27%", height: "30%", tag: "top" as const },
  { left: "0%", bottom: "0%", width: "35%", height: "44%", tag: "bottom" as const },
  { left: "35%", bottom: "0%", width: "28%", height: "33%", tag: "bottom" as const },
  { left: "64%", bottom: "0%", width: "34%", height: "50%", tag: "bottom" as const },
];
const PILE_WRAPS = [5, 3, 4, 0, 1, 2];

export function GiftPile({ names, className }: { names: string[]; className?: string }) {
  return (
    <div className={cn("relative", className)} aria-hidden>
      {PILE.map((spot, i) => (
        <GiftBox
          key={i}
          name={names[i]}
          wrap={WRAPS[PILE_WRAPS[i]]}
          tag={spot.tag}
          className="absolute"
          style={{ left: spot.left, bottom: spot.bottom, width: spot.width, height: spot.height }}
          delay={120 + i * 80}
        />
      ))}
    </div>
  );
}

/** Versão do celular: três presentes lado a lado, de alturas diferentes. */
export function GiftRow({ names }: { names: string[] }) {
  // Proporções (não alturas fixas): a caixa mantém o formato em qualquer largura.
  const sizes = ["aspect-[1/0.85]", "aspect-[1/0.7]", "aspect-square"];
  return (
    <div className="grid grid-cols-3 items-end gap-4 pt-8" aria-hidden>
      {[0, 1, 2].map((i) => (
        <GiftBox key={i} name={names[i]} wrap={WRAPS[[0, 1, 2][i]]} className={sizes[i]} delay={100 + i * 70} />
      ))}
    </div>
  );
}
