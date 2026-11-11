import { cn } from "@/lib/cn";

/** Saco de pano. Com `count`, mostra quantos nomes ainda estão dentro. */
export function Sack({ count, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("relative", className)} aria-hidden>
      <svg viewBox="0 0 140 160" className="size-full overflow-visible">
        {/* boca franzida */}
        <path d="M46 40 C 40 26, 50 14, 44 6 L 96 6 C 90 14, 100 26, 94 40 Z" fill="#cfa972" stroke="#a9834e" strokeWidth="2" />
        <path d="M58 10 L 60 36 M70 8 L 70 36 M82 10 L 80 36" stroke="#b8925f" strokeWidth="1.5" fill="none" />
        {/* corpo */}
        <path
          d="M44 44 C 14 64, 6 118, 30 142 C 46 156, 94 156, 110 142 C 134 118, 126 64, 96 44 Z"
          fill="#d6b483"
          stroke="#a9834e"
          strokeWidth="2"
        />
        <path d="M34 92 C 60 100, 80 100, 106 92" stroke="#c39e6c" strokeWidth="1.5" fill="none" strokeDasharray="4 5" />
        {/* amarração */}
        <rect x="40" y="36" width="60" height="11" rx="5.5" fill="#b8232f" />
        <path d="M70 47 C 64 58, 56 62, 50 60 M70 47 C 76 58, 84 62, 90 60" stroke="#9a1d29" strokeWidth="4" strokeLinecap="round" fill="none" />
      </svg>
      {count !== undefined && (
        <span className="tabular absolute inset-x-0 top-[62%] -translate-y-1/2 text-center">
          <span className="block text-[34px] font-bold leading-none text-[#5c4318]">{count}</span>
          <span className="block text-xs font-medium text-[#5c4318]">{count === 1 ? "nome" : "nomes"}</span>
        </span>
      )}
    </div>
  );
}
