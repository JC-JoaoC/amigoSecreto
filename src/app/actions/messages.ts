"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { runAction } from "@/server/action";
import { requireUserForAction } from "@/server/auth/current-user";
import { type ConversationSide, markConversationRead, sendMessage } from "@/server/services/messages";

export async function sendMessageAction(
  drawId: string,
  side: ConversationSide,
  body: string,
): Promise<ActionResult<{ id: string }>> {
  return runAction("send-message", async () => {
    const user = await requireUserForAction();
    const m = await sendMessage(user, drawId, side, body);
    revalidatePath("/meu-resultado");
    return { id: m.id };
  });
}

/**
 * Sem revalidatePath de propósito: esta action roda ao abrir a conversa, e revalidar o layout
 * aqui disparava uma atualização que abortava outras actions na fila (ex.: enviar mensagem).
 * O contador do menu se atualiza na próxima atualização da página (automática a cada 20 s).
 */
export async function markConversationReadAction(drawId: string, side: ConversationSide): Promise<ActionResult> {
  return runAction("mark-read", async () => {
    const user = await requireUserForAction();
    await markConversationRead(user, drawId, side);
    return undefined;
  });
}
