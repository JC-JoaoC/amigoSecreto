import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Estado vazio: mantém o contexto da seção, uma frase e (opcional) a ação que resolve. */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-start gap-4 rounded-[var(--radius-panel)] border border-dashed border-line-strong px-5 py-6 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <p className="font-medium text-ink">{title}</p>
        {description && <p className="mt-0.5 text-[15px] text-ink-2">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("skeleton rounded-[var(--radius-control)]", className)} />;
}

/** Marcador de status pequeno (20px). Um por linha, no máximo. */
export function StatusPill({ tone = "neutral", children }: { tone?: "neutral" | "positive" | "attention"; children: ReactNode }) {
  const tones = {
    neutral: "bg-mist-2 text-ink-2",
    positive: "bg-pine-100 text-pine-800",
    attention: "bg-[#f6ecc8] text-[#5c4a12]",
  };
  return (
    <span className={cn("inline-flex h-5 items-center rounded px-1.5 text-xs font-medium", tones[tone])}>{children}</span>
  );
}

export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[28px] font-bold leading-tight text-ink">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-base text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-8", className)}>{children}</div>;
}

/** Painel: borda de 1px, sem sombra, sem troca de fundo. */
export function Panel({
  children,
  className,
  as: Tag = "section",
  ...rest
}: { children: ReactNode; className?: string; as?: "section" | "div" | "aside" } & Pick<
  HTMLAttributes<HTMLElement>,
  "aria-label" | "aria-labelledby" | "id"
>) {
  return (
    <Tag className={cn("rounded-[var(--radius-panel)] border border-line bg-white", className)} {...rest}>
      {children}
    </Tag>
  );
}
