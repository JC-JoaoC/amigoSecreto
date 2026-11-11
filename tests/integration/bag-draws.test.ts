import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import {
  addBagEntries,
  createBagDraw,
  deleteBagDraw,
  drawNextFromBag,
  getBagDraw,
  listBagDraws,
  removeBagEntry,
  setBagLast,
} from "@/server/services/bag-draws";
import { actorOf, createUser, resetDb } from "../helpers/db";

beforeEach(resetDb);

async function setup(n: number) {
  const org = await createUser({ name: "Organizadora", organizer: true });
  const people = [];
  for (let i = 0; i < n; i++) people.push(await createUser());
  const bag = await createBagDraw(actorOf(org), { name: "Saco da festa" });
  if (n > 0) await addBagEntries(actorOf(org), bag.id, people.map((p) => p.id));
  return { org, people, bagId: bag.id };
}

/** Tira nomes até acabar. Devolve o vencedor. */
async function drawAll(org: { id: string; role: "USER" | "ORGANIZER" }, bagId: string) {
  for (let i = 0; i < 1000; i++) {
    const r = await drawNextFromBag(actorOf(org), bagId);
    if (r.winner) return r.winner;
  }
  throw new Error("o sorteio não terminou");
}

describe("tirar nomes do saco", () => {
  for (const n of [2, 3, 10]) {
    it(`com ${n} pessoas: ${n - 1} tiradas e 1 sobra como vencedora`, async () => {
      const { org, people, bagId } = await setup(n);

      for (let i = 1; i < n; i++) {
        const r = await drawNextFromBag(actorOf(org), bagId);
        expect(r.drawn?.position).toBe(i);
        if (i < n - 1) {
          expect(r.winner).toBeNull();
          expect(r.remaining).toBe(n - i);
        } else {
          expect(r.winner).not.toBeNull();
          expect(r.remaining).toBe(0);
        }
      }

      const bag = await prisma.bagDraw.findUniqueOrThrow({ where: { id: bagId } });
      expect(bag.status).toBe("COMPLETED");
      expect(bag.startedAt).not.toBeNull();
      expect(bag.completedAt).not.toBeNull();

      const entries = await prisma.bagEntry.findMany({ where: { bagDrawId: bagId }, orderBy: { position: "asc" } });
      expect(entries.map((e) => e.position)).toEqual(Array.from({ length: n }, (_, i) => i + 1));
      expect(new Set(entries.map((e) => e.userId))).toEqual(new Set(people.map((p) => p.id)));
    });
  }

  it("quem foi marcado para ficar por último sempre sobra no saco", async () => {
    for (let round = 0; round < 15; round++) {
      await resetDb();
      const { org, people, bagId } = await setup(5);
      const chosen = people[round % people.length];
      await setBagLast(actorOf(org), bagId, chosen.id);
      const winner = await drawAll(org, bagId);
      expect(winner.userId).toBe(chosen.id);
    }
  });

  it("sem marcação, o vencedor varia", async () => {
    const winners = new Set<string>();
    for (let round = 0; round < 20; round++) {
      await resetDb();
      const { org, bagId } = await setup(3);
      winners.add((await drawAll(org, bagId)).name);
    }
    expect(winners.size).toBeGreaterThan(1);
  });

  it("não deixa tirar depois que terminou", async () => {
    const { org, bagId } = await setup(2);
    await drawNextFromBag(actorOf(org), bagId);
    await expect(drawNextFromBag(actorOf(org), bagId)).rejects.toMatchObject({ code: "DRAW_COMPLETED" });
  });

  it("exige pelo menos 2 pessoas no saco", async () => {
    const { org, bagId } = await setup(1);
    await expect(drawNextFromBag(actorOf(org), bagId)).rejects.toMatchObject({ code: "DRAW_NOT_ENOUGH" });
  });

  it("cliques simultâneos não repetem posição nem tiram a mesma pessoa duas vezes", async () => {
    const { org, bagId } = await setup(6);
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => drawNextFromBag(actorOf(org), bagId)));
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    const entries = await prisma.bagEntry.findMany({ where: { bagDrawId: bagId } });
    const positions = entries.map((e) => e.position).filter((p) => p !== null);
    expect(new Set(positions).size).toBe(6);
    const bag = await prisma.bagDraw.findUniqueOrThrow({ where: { id: bagId } });
    expect(bag.status).toBe("COMPLETED");
  });

  it("depois do primeiro nome, ninguém entra, sai ou muda o último", async () => {
    const { org, people, bagId } = await setup(4);
    const extra = await createUser();
    await drawNextFromBag(actorOf(org), bagId);
    await expect(addBagEntries(actorOf(org), bagId, [extra.id])).rejects.toMatchObject({ code: "DRAW_COMPLETED" });
    await expect(removeBagEntry(actorOf(org), bagId, people[0].id)).rejects.toMatchObject({ code: "DRAW_COMPLETED" });
    await expect(setBagLast(actorOf(org), bagId, people[1].id)).rejects.toMatchObject({ code: "DRAW_COMPLETED" });
  });
});

describe("permissões e privacidade", () => {
  it("só organizador cria, adiciona, marca o último e tira nomes", async () => {
    const { people, bagId } = await setup(3);
    const user = actorOf(people[0]);
    await expect(createBagDraw(user, { name: "Meu saco" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(addBagEntries(user, bagId, [people[1].id])).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(setBagLast(user, bagId, people[0].id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(drawNextFromBag(user, bagId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(deleteBagDraw(user, bagId)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("participante nunca recebe quem foi marcado para ficar por último", async () => {
    const { org, people, bagId } = await setup(3);
    await setBagLast(actorOf(org), bagId, people[2].id);
    const asParticipant = await getBagDraw(actorOf(people[0]), bagId);
    expect(asParticipant.lastUserId).toBeNull();
    const asOrg = await getBagDraw(actorOf(org), bagId);
    expect(asOrg.lastUserId).toBe(people[2].id);
  });

  it("quem não está no saco não vê o sorteio", async () => {
    const { bagId } = await setup(2);
    const outsider = await createUser();
    await expect(getBagDraw(actorOf(outsider), bagId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await listBagDraws(actorOf(outsider))).toHaveLength(0);
  });

  it("só marca como último quem está no saco", async () => {
    const { org, bagId } = await setup(2);
    const outsider = await createUser();
    await expect(setBagLast(actorOf(org), bagId, outsider.id)).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("remover do saco quem estava marcado desfaz a marcação", async () => {
    const { org, people, bagId } = await setup(3);
    await setBagLast(actorOf(org), bagId, people[0].id);
    await removeBagEntry(actorOf(org), bagId, people[0].id);
    const bag = await prisma.bagDraw.findUniqueOrThrow({ where: { id: bagId } });
    expect(bag.lastUserId).toBeNull();
  });
});

describe("consultas", () => {
  it("getBagDraw separa quem está no saco, quem saiu (em ordem) e o vencedor", async () => {
    const { org, bagId } = await setup(4);
    const first = await drawNextFromBag(actorOf(org), bagId);
    let view = await getBagDraw(actorOf(org), bagId);
    expect(view.status).toBe("RUNNING");
    expect(view.drawn.map((d) => d.userId)).toEqual([first.drawn!.userId]);
    expect(view.inBag).toHaveLength(3);
    expect(view.winner).toBeNull();

    const winner = await drawAll(org, bagId);
    view = await getBagDraw(actorOf(org), bagId);
    expect(view.status).toBe("COMPLETED");
    expect(view.inBag).toHaveLength(0);
    expect(view.drawn.map((d) => d.position)).toEqual([1, 2, 3]);
    expect(view.winner?.userId).toBe(winner.userId);
    expect(view.winner?.position).toBe(4);
  });

  it("listBagDraws mostra o vencedor só quando termina", async () => {
    const { org, bagId } = await setup(3);
    await drawNextFromBag(actorOf(org), bagId);
    let [row] = await listBagDraws(actorOf(org));
    expect(row.winnerName).toBeNull();
    const winner = await drawAll(org, bagId);
    [row] = await listBagDraws(actorOf(org));
    expect(row.winnerName).toBe(winner.name);
    expect(row.entryCount).toBe(3);
  });

  it("excluir o sorteio apaga as entradas, mas não as contas", async () => {
    const { org, people, bagId } = await setup(3);
    await deleteBagDraw(actorOf(org), bagId);
    expect(await prisma.bagEntry.count()).toBe(0);
    expect(await prisma.user.count({ where: { id: { in: people.map((p) => p.id) } } })).toBe(3);
  });
});
