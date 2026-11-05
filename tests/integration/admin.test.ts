import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { decrypt } from "@/server/crypto";
import { getDrawAudit } from "@/server/services/admin";
import { addParticipants, createDraw, runDraw } from "@/server/services/draws";
import { sendMessage } from "@/server/services/messages";
import { actorOf, createUser, resetDb } from "../helpers/db";

beforeEach(resetDb);

async function completedDraw(n: number) {
  const org = await createUser({ organizer: true });
  const people = [];
  for (let i = 0; i < n; i++) people.push(await createUser());
  const draw = await createDraw(actorOf(org), { name: "Natal" });
  await addParticipants(actorOf(org), draw.id, people.map((p) => p.id));
  await runDraw(actorOf(org), draw.id);
  const rows = await prisma.drawResult.findMany({ where: { drawId: draw.id }, include: { participant: true } });
  const receiverOf = new Map(
    rows.map((r) => [r.participant.userId, decrypt(r.receiverCipher, `${draw.id}:${r.participantId}`)]),
  );
  return { org, people, drawId: draw.id, receiverOf };
}

describe("área do organizador (pares e mensagens)", () => {
  it("participante comum não acessa", async () => {
    const { people, drawId } = await completedDraw(3);
    await expect(getDrawAudit(actorOf(people[0]), drawId)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("organizador vê quem tirou quem e as conversas decifradas, com o autor de cada mensagem", async () => {
    const { org, people, drawId, receiverOf } = await completedDraw(4);
    const giver = people[0];
    const receiverId = receiverOf.get(giver.id)!;
    const receiver = people.find((p) => p.id === receiverId)!;

    await sendMessage(actorOf(giver), drawId, "receiver", "Livro ou vinho?");
    await sendMessage(actorOf(receiver), drawId, "secret-friend", "Livro!");

    const audit = await getDrawAudit(actorOf(org), drawId);
    expect(audit.isParticipant).toBe(false);
    expect(audit.pairs).toHaveLength(4);
    for (const pair of audit.pairs) {
      expect(pair.receiver?.id).toBe(receiverOf.get(pair.giver.id));
    }

    const pair = audit.pairs.find((p) => p.giver.id === giver.id)!;
    expect(pair.messages.map((m) => [m.from, m.body])).toEqual([
      ["giver", "Livro ou vinho?"],
      ["receiver", "Livro!"],
    ]);
  });

  it("sorteio aberto não tem pares", async () => {
    const org = await createUser({ organizer: true });
    const draw = await createDraw(actorOf(org), { name: "Aberto" });
    const audit = await getDrawAudit(actorOf(org), draw.id);
    expect(audit.draw.status).toBe("OPEN");
    expect(audit.pairs).toEqual([]);
  });

  it("sorteio inexistente dá NOT_FOUND", async () => {
    const org = await createUser({ organizer: true });
    await expect(getDrawAudit(actorOf(org), "naoexiste123")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
