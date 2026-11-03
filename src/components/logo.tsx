import { cn } from "@/lib/cn";
import { BRAND } from "@/lib/brand";

/** Marca: um laço de fita, desenhado em duas cores chapadas. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden>
      <path d="M16 15c-3-5.5-9.5-7.5-11-4.2S9.5 17 16 15Z" fill="#b8232f" />
      <path d="M16 15c3-5.5 9.5-7.5 11-4.2S22.5 17 16 15Z" fill="#b8232f" />
      <path d="M14.6 16 10 27l3.4-.9 1.6 3L16 17.6l1 11.5 1.6-3 3.4.9-4.6-11Z" fill="#0f2a1f" />
      <circle cx="16" cy="15.4" r="2.3" fill="#0f2a1f" />
    </svg>
  );
}

export function Logo({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)} translate="no">
      <LogoMark />
      <span className={cn("text-[22px] font-bold tracking-tight", inverted ? "text-white" : "text-ink")}>{BRAND.name}</span>
    </span>
  );
}
