/** URL pública da foto de perfil. A data entra na URL: trocar a foto muda o endereço (sem cache velho). */
export function avatarUrl(userId: string, avatarUpdatedAt: Date | string | null | undefined): string | null {
  if (!avatarUpdatedAt) return null;
  return `/api/avatar/${userId}?v=${new Date(avatarUpdatedAt).getTime()}`;
}

/** URL pública da foto do presente, versionada do mesmo jeito. */
export function giftImageUrl(giftId: string, imageUpdatedAt: Date | string | null | undefined): string | null {
  if (!imageUpdatedAt) return null;
  return `/api/gift-image/${giftId}?v=${new Date(imageUpdatedAt).getTime()}`;
}
