"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import type { BagDrawInput } from "@/lib/validation";
import { runAction } from "@/server/action";
import { requireUserForAction } from "@/server/auth/current-user";
import {
  addBagEntries,
  createBagDraw,
  deleteBagDraw,
  drawNextFromBag,
  listAddableBagUsers,
  removeBagEntry,
  setBagLast,
  updateBagDraw,
} from "@/server/services/bag-draws";

function refresh(bagId?: string) {
  revalidatePath("/saco");
  if (bagId) revalidatePath(`/saco/${bagId}`);
}

export async function createBagDrawAction(input: BagDrawInput): Promise<ActionResult<{ id: string }>> {
  return runAction(
    "create-bag",
    async () => {
      const user = await requireUserForAction();
      const bag = await createBagDraw(user, input);
      refresh();
      return { id: bag.id };
    },
    "Sorteio criado! Agora coloque as pessoas no saco.",
  );
}

export async function updateBagDrawAction(bagId: string, input: BagDrawInput): Promise<ActionResult> {
  return runAction(
    "update-bag",
    async () => {
      const user = await requireUserForAction();
      await updateBagDraw(user, bagId, input);
      refresh(bagId);
      return undefined;
    },
    "Sorteio atualizado.",
  );
}

export async function deleteBagDrawAction(bagId: string): Promise<ActionResult> {
  return runAction(
    "delete-bag",
    async () => {
      const user = await requireUserForAction();
      await deleteBagDraw(user, bagId);
      refresh();
      return undefined;
    },
    "Sorteio excluído.",
  );
}

export async function searchAddableBagUsersAction(
  bagId: string,
  q: string,
): Promise<ActionResult<{ id: string; name: string; avatarUrl: string | null }[]>> {
  return runAction("search-addable-bag", async () => {
    const user = await requireUserForAction();
    return listAddableBagUsers(user, bagId, q);
  });
}

export async function addBagEntriesAction(bagId: string, userIds: string[]): Promise<ActionResult<{ added: number }>> {
  return runAction("add-bag-entries", async () => {
    const user = await requireUserForAction();
    const r = await addBagEntries(user, bagId, userIds);
    refresh(bagId);
    return r;
  });
}

export async function removeBagEntryAction(bagId: string, userId: string): Promise<ActionResult> {
  return runAction(
    "remove-bag-entry",
    async () => {
      const user = await requireUserForAction();
      await removeBagEntry(user, bagId, userId);
      refresh(bagId);
      return undefined;
    },
    "Removido do saco.",
  );
}

export async function setBagLastAction(bagId: string, userId: string | null): Promise<ActionResult> {
  return runAction(
    "set-bag-last",
    async () => {
      const user = await requireUserForAction();
      await setBagLast(user, bagId, userId);
      refresh(bagId);
      return undefined;
    },
    "Configuração salva.",
  );
}

export async function drawNextFromBagAction(bagId: string): Promise<
  ActionResult<{
    drawn: { userId: string; name: string; position: number } | null;
    winner: { userId: string; name: string } | null;
    remaining: number;
  }>
> {
  return runAction("draw-next-bag", async () => {
    const user = await requireUserForAction();
    const r = await drawNextFromBag(user, bagId);
    refresh(bagId);
    return r;
  });
}
