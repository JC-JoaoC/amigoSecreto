/** Datas "só dia" (ex.: data do evento) são gravadas em UTC: formatamos em UTC para não "voltar um dia". */
export function formatDay(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(date),
  );
}

export function formatDateTime(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(date));
}

/** Date -> "AAAA-MM-DD" para <input type="date">. */
export function toDateInput(date: Date | string | null | undefined): string {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

/** "20 de dez.": datas curtas para espaços apertados. */
export function formatDayShort(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(date));
}
