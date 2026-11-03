import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { decrypt } from "@/server/crypto";
import {
  addParticipants,
  createDraw,
  deleteDraw,
  getDraw,
  getMyResult,
  joinDraw,
  leaveDraw,
  listDraws,
  listMyParticipations,
  removeParticipant,
  runDraw,
} from "@/server/services/draws";
import { deleteMyAccount } from "@/server/services/users";
import { actorOf, createUser, resetDb } from "../helpers/db";

beforeEach(resetDb);

async function setup(n: number) {
  const org = await createUser({ name: "Organizadora", organizer: true });
  const people = [];
  for (let i = 0; i < n; i++) people.push(await createUser());
  const draw = await createDraw(actorOf(org), { name: "Natal da Firma", budget: "R$ 100" });
  if (n > 0) await addParticipants(actorOf(org), draw.id, people.map((p) => p.id));
  return { org, people, drawId: draw.id };
}

/** Lê todos os resultados decifrando no teste (o app nunca faz isso em lote). */
async function allAssignments(drawId: string) {
  const rows = await prisma.drawResult.findMany({ where: { drawId }, include: { participant: true } });
  return rows.map((r) => ({
    giver: r.participant.userId,
    receiver: decrypt(r.receiverCipher, `${drawId}:${r.participantId}`),
  }));
}

describe("execução do sorteio", () => {
  for (const n of [2, 3, 10, 50]) {
    it(`sorteio válido com ${n} participantes`, async () => {
      const { org, people, drawId } = await setup(n);
      const r = await runDraw(actorOf(org), drawId);
      expect(r.participantCount).toBe(n);

      const draw = await prisma.draw.findUniqueOrThrow({ where: { id: drawId } });
      expect(draw.status).toBe("COMPLETED");
      expect(draw.completedAt).not.toBeNull();

      const assignments = await allAssignments(drawId);
      const ids = new Set(people.map((p) => p.id));
      expect(assignments).toHaveLength(n);
      for (const a of assignments) expect(a.receiver).not.toBe(a.giver); // ninguém tira a si
      expect(new Set(assignments.map((a) => a.giver))).toEqual(ids); // todos tiram alguém
      expect(new Set(assignments.map((a) => a.receiver))).toEqual(ids); // todos são tirados 1 vez
    });
  }

  it("o destinatário não fica legível no banco", async () => {
    const { org, people, drawId } = await setup(3);
    await runDraw(actorOf(org), drawId);
    const raw = JSON.stringify(await prisma.drawResult.findMany({ where: { drawId } }));
    for (const p of people) {
      // o id de quem presenteia aparece só via participant_id (outro id); o do sorteado, nunca
      expect(raw).not.toContain(p.id);
    }
  });

  it("impede execução duplicada", async () => {
    const { org, drawId } = await setup(4);
    await runDraw(actorOf(org), drawId);
    const before = await allAssignments(drawId);
    await expect(runDraw(actorOf(org), drawId)).rejects.toMatchObject({ code: "DRAW_COMPLETED" });
    expect(await allAssignments(drawId)).toEqual(before);
  });

  it("execuções simultâneas: só uma vence, sem resultados duplicados", async () => {
    const { org, drawId } = await setup(8);
    const attempts = await Promise.allSettled(Array.from({ length: 5 }, () => runDraw(actorOf(org), drawId)));
    expect(attempts.filter((a) => a.status === "fulfilled")).toHaveLength(1);
    for (const a of attempts.filter((x) => x.status === "rejected")) {
      expect((a as PromiseRejectedResult).reason).toMatchObject({ code: "DRAW_COMPLETED" });
    }
    expect(await prisma.drawResult.count({ where: { drawId } })).toBe(8);
  });

  it("impede sorteio com 1 participante (e com nenhum)", async () => {
    const one = await setup(1);
    await expect(runDraw(actorOf(one.org), one.drawId)).rejects.toMatchObject({ code: "DRAW_NOT_ENOUGH" });
    expect((await prisma.draw.findUniqueOrThrow({ where: { id: one.drawId } })).status).toBe("OPEN");

    const empty = await createDraw(actorOf(one.org), { name: "Vazio" });
    await expect(runDraw(actorOf(one.org), empty.id)).rejects.toMatchObject({ code: "DRAW_NOT_ENOUGH" });
  });

  it("falha durante a gravação desfaz tudo (sem resultado parcial)", async () => {
    const { org, drawId } = await setup(5);
    await expect(
      runDraw(actorOf(org), drawId, {
        beforeCommit: async () => {
          throw new Error("falha simulada no meio da transação");
        },
      }),
    ).rejects.toThrow("falha simulada");
    const draw = await prisma.draw.findUniqueOrThrow({ where: { id: drawId } });
    expect(draw.status).toBe("OPEN");
    expect(draw.completedAt).toBeNull();
    expect(await prisma.drawResult.count({ where: { drawId } })).toBe(0);
    // E depois o sorteio funciona normalmente.
    await expect(runDraw(actorOf(org), drawId)).resolves.toMatchObject({ participantCount: 5 });
  });

  it("apenas organizadores podem executar o sorteio", async () => {
    const { people, drawId } = await setup(3);
    await expect(runDraw(actorOf(people[0]), drawId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await prisma.drawResult.count()).toBe(0);
  });
});

describe("privacidade dos resultados", () => {
  it("cada participante vê somente o próprio resultado", async () => {
    const { org, people, drawId } = await setup(6);
    await runDraw(actorOf(org), drawId);
    const truth = new Map((await allAssignments(drawId)).map((a) => [a.giver, a.receiver]));
    for (const p of people) {
      const mine = await getMyResult(actorOf(p), drawId);
      expect(mine.receiver.id).toBe(truth.get(p.id));
      expect(mine.receiver.id).not.toBe(p.id);
    }
  });

  it("quem não participa (inclusive o organizador) não consegue ver resultado algum", async () => {
    const { org, drawId } = await setup(3);
    const outsider = await createUser();
    await runDraw(actorOf(org), drawId);
    await expect(getMyResult(actorOf(org), drawId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getMyResult(actorOf(outsider), drawId)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("detalhes e listagens do sorteio não carregam nenhum dado de resultado", async () => {
    const { org, people, drawId } = await setup(4);
    await runDraw(actorOf(org), drawId);
    const payloads = [
      await getDraw(actorOf(org), drawId),
      await getDraw(actorOf(people[0]), drawId),
      await listDraws(actorOf(org)),
      await listMyParticipations(actorOf(people[0])),
    ];
    for (const p of payloads) {
      const json = JSON.stringify(p);
      expect(json).not.toMatch(/receiver|cipher/i);
    }
  });

  it("antes do sorteio, ninguém tem resultado", async () => {
    const { people, drawId } = await setup(3);
    await expect(getMyResult(actorOf(people[0]), drawId)).rejects.toMatchObject({ code: "DRAW_NOT_READY" });
  });

  it("registra quando a pessoa revelou e o organizador vê só a contagem", async () => {
    const { org, people, drawId } = await setup(3);
    await runDraw(actorOf(org), drawId);
    await getMyResult(actorOf(people[0]), drawId);
    const d = await getDraw(actorOf(org), drawId);
    expect(d.revealedCount).toBe(1);
    expect((await getDraw(actorOf(people[1]), drawId)).revealedCount).toBeNull();
    expect((await listMyParticipations(actorOf(people[0])))[0].revealed).toBe(true);
  });
});

describe("preparação e participantes", () => {
  it("participante entra e sai de um sorteio aberto", async () => {
    const { org, drawId } = await setup(0);
    const u = await createUser();
    await joinDraw(actorOf(u), drawId);
    await joinDraw(actorOf(u), drawId); // idempotente: sem duplicar
    expect(await prisma.drawParticipant.count({ where: { drawId } })).toBe(1);
    await leaveDraw(actorOf(u), drawId);
    expect(await prisma.drawParticipant.count({ where: { drawId } })).toBe(0);
    expect((await getDraw(actorOf(org), drawId)).participants).toHaveLength(0);
  });

  it("participantes duplicados são ignorados ao adicionar", async () => {
    const { org, people, drawId } = await setup(3);
    const r = await addParticipants(actorOf(org), drawId, [people[0].id, people[0].id, people[1].id]);
    expect(r.added).toBe(0);
    expect(await prisma.drawParticipant.count({ where: { drawId } })).toBe(3);
  });

  it("não adiciona contas não verificadas", async () => {
    const { org, drawId } = await setup(0);
    const pending = await createUser({ verified: false });
    expect((await addParticipants(actorOf(org), drawId, [pending.id])).added).toBe(0);
  });

  it("organizador remove participante antes do sorteio", async () => {
    const { org, people, drawId } = await setup(3);
    await removeParticipant(actorOf(org), drawId, people[0].id);
    expect(await prisma.drawParticipant.count({ where: { drawId } })).toBe(2);
  });

  it("usuário removido durante a preparação fica fora do sorteio", async () => {
    const { org, people, drawId } = await setup(4);
    await deleteMyAccount(people[0].id);
    const r = await runDraw(actorOf(org), drawId);
    expect(r.participantCount).toBe(3);
    const receivers = (await allAssignments(drawId)).map((a) => a.receiver);
    expect(receivers).not.toContain(people[0].id);
  });

  it("depois do sorteio ninguém entra, sai ou é removido", async () => {
    const { org, people, drawId } = await setup(3);
    const late = await createUser();
    await runDraw(actorOf(org), drawId);
    await expect(joinDraw(actorOf(late), drawId)).rejects.toMatchObject({ code: "DRAW_COMPLETED" });
    await expect(leaveDraw(actorOf(people[0]), drawId)).rejects.toMatchObject({ code: "DRAW_COMPLETED" });
    await expect(removeParticipant(actorOf(org), drawId, people[0].id)).rejects.toMatchObject({ code: "DRAW_COMPLETED" });
    await expect(addParticipants(actorOf(org), drawId, [late.id])).rejects.toMatchObject({ code: "DRAW_COMPLETED" });
  });

  it("usuário comum não gerencia sorteios", async () => {
    const { people, drawId } = await setup(2);
    const u = actorOf(people[0]);
    await expect(createDraw(u, { name: "Meu sorteio" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(addParticipants(u, drawId, [people[1].id])).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(removeParticipant(u, drawId, people[1].id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(deleteDraw(u, drawId)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("usuário comum não vê sorteio realizado do qual não participa", async () => {
    const { org, drawId } = await setup(2);
    const outsider = await createUser();
    await runDraw(actorOf(org), drawId);
    await expect(getDraw(actorOf(outsider), drawId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await listDraws(actorOf(outsider))).toHaveLength(0);
  });
});

describe("exclusão e integridade", () => {
  it("conta em sorteio realizado não pode ser excluída; após excluir o sorteio, pode", async () => {
    const { org, people, drawId } = await setup(3);
    await runDraw(actorOf(org), drawId);
    await expect(deleteMyAccount(people[0].id)).rejects.toMatchObject({ code: "CONFLICT" });
    await deleteDraw(actorOf(org), drawId);
    expect(await prisma.drawResult.count()).toBe(0);
    await expect(deleteMyAccount(people[0].id)).resolves.toBeUndefined();
  });

  it("o banco recusa marcar sorteio como realizado sem resultados completos", async () => {
    const { drawId } = await setup(3);
    await expect(
      prisma.draw.update({ where: { id: drawId }, data: { status: "COMPLETED" } }),
    ).rejects.toThrow(/Sorteio inconsistente/);
    expect((await prisma.draw.findUniqueOrThrow({ where: { id: drawId } })).status).toBe("OPEN");
  });

  it("o banco recusa reabrir sorteio, alterar resultado ou mexer em participantes", async () => {
    const { org, people, drawId } = await setup(3);
    const late = await createUser();
    await runDraw(actorOf(org), drawId);

    await expect(prisma.draw.update({ where: { id: drawId }, data: { status: "OPEN" } })).rejects.toThrow(/não pode ser reaberto/);
    const row = await prisma.drawResult.findFirstOrThrow({ where: { drawId } });
    await expect(
      prisma.drawResult.update({ where: { id: row.id }, data: { receiverCipher: "v1.adulterado" } }),
    ).rejects.toThrow(/imutáveis/);
    await expect(prisma.drawParticipant.create({ data: { drawId, userId: late.id } })).rejects.toThrow(/não podem ser alterados/);
    await expect(
      prisma.drawParticipant.deleteMany({ where: { drawId, userId: people[0].id } }),
    ).rejects.toThrow(/não podem ser alterados/);
    // Exclusão direta da conta também é barrada pelo banco.
    await expect(prisma.user.delete({ where: { id: people[0].id } })).rejects.toThrow(/não podem ser alterados|foreign key|violates/i);
  });
});
