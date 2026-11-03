"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { runAction } from "@/server/action";
import { clearSessionCookie, requireUserForAction } from "@/server/auth/current-user";
import { AppError } from "@/server/errors";
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
