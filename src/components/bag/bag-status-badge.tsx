import { StatusPill } from "@/components/ui/misc";

export type BagStatus = "OPEN" | "RUNNING" | "COMPLETED";

export function BagStatusBadge({ status }: { status: BagStatus }) {
  if (status === "OPEN") return <StatusPill tone="attention">Montando o saco</StatusPill>;
  if (status === "RUNNING") return <StatusPill tone="attention">Tirando nomes</StatusPill>;
  return <StatusPill tone="positive">Sorteio concluído</StatusPill>;
}
