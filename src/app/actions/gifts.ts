"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import type { GiftInput } from "@/lib/validation";
import { runAction } from "@/server/action";
import { requireUserForAction } from "@/server/auth/current-user";
import { AppError } from "@/server/errors";
import { IMAGE_MAX_INPUT_BYTES } from "@/server/images";
import { type PreviewResult, previewProductImage, removeGiftImage, setGiftImage } from "@/server/services/gift-images";
import { createGift, deleteGift, updateGift } from "@/server/services/gifts";

function refresh(userId: string) {
  revalidatePath("/meus-presentes");
  revalidatePath(`/participantes/${userId}`);
  revalidatePath("/");
}

export async function createGiftAction(input: GiftInput): Promise<ActionResult<{ id: string }>> {
  return runAction(
    "create-gift",
    async () => {
      const user = await requireUserForAction();
      const gift = await createGift(user.id, input);
      refresh(user.id);
      return { id: gift.id };
    },
    "Presente adicionado à sua lista!",
  );
}

export async function updateGiftAction(giftId: string, input: GiftInput): Promise<ActionResult<{ id: string }>> {
  return runAction(
    "update-gift",
    async () => {
      const user = await requireUserForAction();
      const gift = await updateGift(user.id, giftId, input);
      refresh(user.id);
      return { id: gift.id };
    },
    "Presente atualizado.",
  );
}

export async function deleteGiftAction(giftId: string): Promise<ActionResult> {
  return runAction(
    "delete-gift",
    async () => {
      const user = await requireUserForAction();
      await deleteGift(user.id, giftId);
      refresh(user.id);
      return undefined;
    },
    "Presente removido da lista.",
  );
}

/** Busca a foto do produto na página da loja (só mostra; salvar é outro passo). */
export async function previewGiftImageAction(url: string): Promise<ActionResult<PreviewResult>> {
  return runAction("preview-gift-image", async () => {
    const user = await requireUserForAction();
    return previewProductImage(user.id, url);
  });
}

export async function uploadGiftImageAction(giftId: string, formData: FormData): Promise<ActionResult> {
  return runAction("upload-gift-image", async () => {
    const user = await requireUserForAction();
    const file = formData.get("photo");
    if (!(file instanceof File)) throw new AppError("VALIDATION", "Escolha uma foto.");
    if (file.size > IMAGE_MAX_INPUT_BYTES) throw new AppError("VALIDATION", "A foto é grande demais. Use uma imagem de até 8 MB.");
    await setGiftImage(user.id, giftId, Buffer.from(await file.arrayBuffer()));
    refresh(user.id);
    return undefined;
  });
}

export async function removeGiftImageAction(giftId: string): Promise<ActionResult> {
  return runAction("remove-gift-image", async () => {
    const user = await requireUserForAction();
    await removeGiftImage(user.id, giftId);
    refresh(user.id);
    return undefined;
  });
}
