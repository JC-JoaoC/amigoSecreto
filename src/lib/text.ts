/** Utilitários de texto compartilhados entre cliente e servidor. */

/** Remove espaços extras e padroniza o nome para exibição. */
export function cleanName(name: string): string {
  return name.normalize("NFC").trim().replace(/\s+/g, " ");
}

/** Normaliza e-mail para evitar duplicidade por maiúsculas/minúsculas e espaços. */
export function normalizeEmail(email: string): string {
  return email.normalize("NFC").trim().toLowerCase();
}

/** Versão do nome usada em buscas: minúsculas e sem acentos ("João" -> "joao"). */
export function toSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/** Iniciais para avatar: primeira letra do primeiro e do último nome. */
export function initials(name: string): string {
  const parts = cleanName(name).split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** Primeiro nome, para saudações. */
export function firstName(name: string): string {
  return cleanName(name).split(" ")[0] ?? name;
}

/** Domínio legível de uma URL, ex.: "www.loja.com.br/x" -> "loja.com.br". */
export function displayHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
