"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import type { ActionResult } from "@/lib/action-result";
import type { DrawInput } from "@/lib/validation";
import { runAction } from "@/server/action";
import { requireUserForAction } from "@/server/auth/current-user";
import {
  addParticipants,
  createDraw,
  deleteDraw,
  getMyResult,
  joinDraw,
  leaveDraw,
  listAddableUsers,
  notifyDrawCompleted,
  removeParticipant,
  runDraw,
  updateDraw,
} from "@/server/services/draws";

function refresh(drawId?: string) {
  revalidatePath("/sorteios");
  revalidatePath("/meu-resultado");
  if (drawId) revalidatePath(`/sorteios/${drawId}`);
}

export async function createDrawAction(input: DrawInput): Promise<ActionResult<{ id: string }>> {
  return runAction(
    "create-draw",
    async () => {
      const user = await requireUserForAction();
      const draw = await createDraw(user, input);
      refresh();
      return { id: draw.id };
    },
    "Sorteio criado! Agora adicione os participantes.",
  );
}

export async function updateDrawAction(drawId: string, input: DrawInput): Promise<ActionResult> {
  return runAction(
    "update-draw",
    async () => {
      const user = await requireUserForAction();
      await updateDraw(user, drawId, input);
      refresh(drawId);
      return undefined;
    },
    "Sorteio atualizado.",
  );
}

export async function deleteDrawAction(drawId: string): Promise<ActionResult> {
  return runAction(
    "delete-draw",
    async () => {
      const user = await requireUserForAction();
      await deleteDraw(user, drawId);
      refresh();
      return undefined;
    },
    "Sorteio excluído.",
  );
}

export async function joinDrawAction(drawId: string): Promise<ActionResult> {
  return runAction(
    "join-draw",
    async () => {
      const user = await requireUserForAction();
      await joinDraw(user, drawId);
      refresh(drawId);
      return undefined;
    },
    "Você está participando!",
  );
}

export async function leaveDrawAction(drawId: string): Promise<ActionResult> {
  return runAction(
    "leave-draw",
    async () => {
      const user = await requireUserForAction();
      await leaveDraw(user, drawId);
      refresh(drawId);
      return undefined;
    },
    "Você saiu deste sorteio.",
  );
}

export async function searchAddableUsersAction(
  drawId: string,
  q: string,
): Promise<ActionResult<{ id: string; name: string; avatarUrl: string | null }[]>> {
  return runAction("search-addable", async () => {
    const user = await requireUserForAction();
    return listAddableUsers(user, drawId, q);
  });
}

export async function addParticipantsAction(drawId: string, userIds: string[]): Promise<ActionResult<{ added: number }>> {
  return runAction("add-participants", async () => {
    const user = await requireUserForAction();
    const r = await addParticipants(user, drawId, userIds);
    refresh(drawId);
    return r;
  });
}

export async function removeParticipantAction(drawId: string, userId: string): Promise<ActionResult> {
  return runAction(
    "remove-participant",
    async () => {
      const user = await requireUserForAction();
      await removeParticipant(user, drawId, userId);
      refresh(drawId);
      return undefined;
    },
    "Participante removido.",
  );
}

export async function runDrawAction(drawId: string): Promise<ActionResult<{ participantCount: number }>> {
  return runAction(
    "run-draw",
    async () => {
      const user = await requireUserForAction();
      const result = await runDraw(user, drawId);
      // Avisos por e-mail depois da resposta. Falhas de envio não afetam o sorteio.
      after(() => notifyDrawCompleted(result));
      refresh(drawId);
      return { participantCount: result.participantCount };
    },
    "Sorteio realizado! Cada participante já pode descobrir quem tirou.",
  );
}

/** Revela o resultado do PRÓPRIO usuário. O nome só sai do servidor nesta chamada. */
export async function revealMyResultAction(drawId: string): Promise<
  ActionResult<{ receiver: { id: string; name: string; giftCount: number }; drawName: string }>
> {
  return runAction("reveal-result", async () => {
    const user = await requireUserForAction();
    const r = await getMyResult(user, drawId);
    return { receiver: r.receiver, drawName: r.draw.name };
  });
}
