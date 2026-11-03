"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import type { GiftInput } from "@/lib/validation";
import { runAction } from "@/server/action";
import { requireUserForAction } from "@/server/auth/current-user";
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
