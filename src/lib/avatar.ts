/** URL pública da foto de perfil. A data entra na URL: trocar a foto muda o endereço (sem cache velho). */
export function avatarUrl(userId: string, avatarUpdatedAt: Date | string | null | undefined): string | null {
  if (!avatarUpdatedAt) return null;
  return `/api/avatar/${userId}?v=${new Date(avatarUpdatedAt).getTime()}`;
}
