import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { decrypt } from "@/server/crypto";
import { addParticipants, createDraw, deleteDraw, runDraw } from "@/server/services/draws";
import {
  countUnreadMessages,
  getConversations,
  markConversationRead,
  sendMessage,
} from "@/server/services/messages";
import { actorOf, createUser, resetDb } from "../helpers/db";

beforeEach(resetDb);

/** Sorteio realizado + mapa "quem tirou quem" (lido decifrando, só no teste). */
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
  const giverOf = new Map([...receiverOf].map(([g, r]) => [r, g]));
  const byId = new Map(people.map((p) => [p.id, p]));
  return { org, people, drawId: draw.id, receiverOf, giverOf, byId };
}

describe("mensagens anônimas", () => {
  it("amigo secreto escreve para quem tirou; o sorteado lê e responde sem saber quem é", async () => {
    const { people, drawId, receiverOf, byId } = await completedDraw(4);
    const giver = people[0];
    const receiver = byId.get(receiverOf.get(giver.id)!)!;

    await sendMessage(actorOf(giver), drawId, "receiver", "Você prefere livro ou vinho?");

    const forReceiver = await getConversations(actorOf(receiver), drawId);
    expect(forReceiver.withSecretFriend!.messages).toEqual([
      expect.objectContaining({ mine: false, body: "Você prefere livro ou vinho?" }),
    ]);
    expect(forReceiver.withSecretFriend!.unread).toBe(1);
    // Nada na resposta identifica quem escreveu.
    const json = JSON.stringify(forReceiver);
    expect(json).not.toContain(giver.id);
    expect(json).not.toContain(giver.name);
    expect(json).not.toContain(giver.email);

    await sendMessage(actorOf(receiver), drawId, "secret-friend", "Livro, por favor!");
    const forGiver = await getConversations(actorOf(giver), drawId);
    expect(forGiver.withReceiver!.messages.map((m) => [m.mine, m.body])).toEqual([
      [true, "Você prefere livro ou vinho?"],
      [false, "Livro, por favor!"],
    ]);
  });

  it("terceiros não leem a conversa de outro par", async () => {
    const { people, drawId, receiverOf, giverOf } = await completedDraw(5);
    const giver = people[0];
    const receiverId = receiverOf.get(giver.id)!;
    await sendMessage(actorOf(giver), drawId, "receiver", "segredo do par");

    for (const p of people) {
      if (p.id === giver.id || p.id === receiverId) continue;
      const c = await getConversations(actorOf(p), drawId);
      const all = [...(c.withReceiver?.messages ?? []), ...(c.withSecretFriend?.messages ?? [])];
      expect(all.map((m) => m.body)).not.toContain("segredo do par");
    }
    expect(giverOf.get(receiverId)).toBe(giver.id);
  });

  it("organizador e pessoas de fora não têm acesso", async () => {
    const { org, drawId } = await completedDraw(3);
    const outsider = await createUser();
    await expect(getConversations(actorOf(org), drawId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getConversations(actorOf(outsider), drawId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(sendMessage(actorOf(outsider), drawId, "receiver", "oi")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("antes do sorteio não há conversa", async () => {
    const org = await createUser({ organizer: true });
    const a = await createUser();
    const b = await createUser();
    const draw = await createDraw(actorOf(org), { name: "Aberto" });
    await addParticipants(actorOf(org), draw.id, [a.id, b.id]);
    await expect(sendMessage(actorOf(a), draw.id, "receiver", "oi")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("texto fica cifrado no banco e o autor não é gravado", async () => {
    const { people, drawId } = await completedDraw(3);
    await sendMessage(actorOf(people[0]), drawId, "receiver", "mensagem bem secreta");
    const raw = await prisma.$queryRawUnsafe<Record<string, unknown>[]>('SELECT * FROM "draw_messages"');
    const dump = JSON.stringify(raw);
    expect(dump).not.toContain("mensagem bem secreta");
    for (const p of people) expect(dump).not.toContain(p.id);
  });

  it("valida o texto", async () => {
    const { people, drawId } = await completedDraw(2);
    await expect(sendMessage(actorOf(people[0]), drawId, "receiver", "   ")).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(sendMessage(actorOf(people[0]), drawId, "receiver", "x".repeat(1001))).rejects.toMatchObject({
      code: "VALIDATION",
    });
    await expect(sendMessage(actorOf(people[0]), drawId, "admin", "oi")).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("contador de não lidas e marcação como lida", async () => {
    const { people, drawId, receiverOf, byId } = await completedDraw(3);
    const giver = people[0];
    const receiver = byId.get(receiverOf.get(giver.id)!)!;
    await sendMessage(actorOf(giver), drawId, "receiver", "um");
    await sendMessage(actorOf(giver), drawId, "receiver", "dois");

    expect(await countUnreadMessages(actorOf(receiver))).toBe(2);
    expect(await countUnreadMessages(actorOf(giver))).toBe(0); // as próprias não contam

    await markConversationRead(actorOf(receiver), drawId, "secret-friend");
    expect(await countUnreadMessages(actorOf(receiver))).toBe(0);

    await sendMessage(actorOf(receiver), drawId, "secret-friend", "resposta");
    expect(await countUnreadMessages(actorOf(giver))).toBe(1);
  });

  it("excluir o sorteio apaga as conversas", async () => {
    const { org, people, drawId } = await completedDraw(3);
    await sendMessage(actorOf(people[0]), drawId, "receiver", "oi");
    await deleteDraw(actorOf(org), drawId);
    expect(await prisma.drawMessage.count()).toBe(0);
  });
});
