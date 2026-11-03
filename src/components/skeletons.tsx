import { Container, Skeleton } from "@/components/ui/misc";

/** Carregamento com a forma final da página: blocos planos, sem shimmer. */
export function PageSkeleton({ rows = 6, variant = "list" }: { rows?: number; variant?: "list" | "people" }) {
  return (
    <Container className="py-10 sm:py-14">
      <div role="status" aria-label="Carregando…">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-3 h-5 w-[26rem] max-w-full" />
        {variant === "people" ? (
          <div className="mt-10 gap-x-10 sm:columns-2 lg:columns-3">
            {Array.from({ length: rows }, (_, i) => (
              <div key={i} className="mb-3 flex break-inside-avoid items-center gap-3 py-2">
                <Skeleton className="size-10 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-10 divide-y divide-line rounded-[var(--radius-panel)] border border-line">
            {Array.from({ length: rows }, (_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
                <Skeleton className="h-9 w-28" />
              </div>
            ))}
          </div>
        )}
      </div>
    </Container>
  );
}
