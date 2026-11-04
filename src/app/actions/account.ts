"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { runAction } from "@/server/action";
import { clearSessionCookie, requireUserForAction } from "@/server/auth/current-user";
import { AppError } from "@/server/errors";
import { AVATAR_MAX_UPLOAD_BYTES, removeAvatar, setAvatar } from "@/server/services/avatars";
import { deleteMyAccount, updateMyName } from "@/server/services/users";

export async function updateNameAction(name: string): Promise<ActionResult<{ name: string }>> {
  return runAction(
    "update-name",
    async () => {
      const user = await requireUserForAction();
      const r = await updateMyName(user.id, name);
      revalidatePath("/", "layout");
      return r;
    },
    "Nome atualizado.",
  );
}

export async function deleteAccountAction(confirmation: string): Promise<ActionResult> {
  return runAction("delete-account", async () => {
    const user = await requireUserForAction();
    if (confirmation.trim().toUpperCase() !== "EXCLUIR") {
      throw new AppError("VALIDATION", "Digite EXCLUIR para confirmar.");
    }
    await deleteMyAccount(user.id);
    await clearSessionCookie();
    revalidatePath("/", "layout");
    return undefined;
  });
}

export async function uploadAvatarAction(formData: FormData): Promise<ActionResult> {
  return runAction(
    "upload-avatar",
    async () => {
      const user = await requireUserForAction();
      const file = formData.get("photo");
      if (!(file instanceof File)) throw new AppError("VALIDATION", "Escolha uma foto.");
      if (file.size > AVATAR_MAX_UPLOAD_BYTES) throw new AppError("VALIDATION", "A foto é grande demais. Use uma imagem de até 5 MB.");
      await setAvatar(user.id, Buffer.from(await file.arrayBuffer()));
      revalidatePath("/", "layout");
      return undefined;
    },
    "Foto de perfil atualizada.",
  );
}

export async function removeAvatarAction(): Promise<ActionResult> {
  return runAction(
    "remove-avatar",
    async () => {
      const user = await requireUserForAction();
      await removeAvatar(user.id);
      revalidatePath("/", "layout");
      return undefined;
    },
    "Foto removida.",
  );
}
