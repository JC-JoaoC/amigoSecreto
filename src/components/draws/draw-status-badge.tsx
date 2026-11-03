import { StatusPill } from "@/components/ui/misc";

export function DrawStatusBadge({ status }: { status: "OPEN" | "COMPLETED" }) {
  return status === "OPEN" ? (
    <StatusPill tone="attention">Aberto para participantes</StatusPill>
  ) : (
    <StatusPill tone="positive">Sorteio realizado</StatusPill>
  );
}
