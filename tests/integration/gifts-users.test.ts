import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { createGift, deleteGift, listMyGifts, updateGift } from "@/server/services/gifts";
import { deleteMyAccount, getParticipantWithGifts, listParticipants, updateMyName } from "@/server/services/users";
import { createUser, resetDb } from "../helpers/db";

beforeEach(resetDb);

describe("presentes", () => {
  it("adicionar, editar e excluir o próprio presente", async () => {
    const u = await createUser();
    const g = await createGift(u.id, {
      title: "Fone Bluetooth JBL",
      url: "https://www.exemplo.com.br/produto",
      description: "Preferencialmente na cor preta",
    });
    expect(g.title).toBe("Fone Bluetooth JBL");

    const edited = await updateGift(u.id, g.id, { title: "Fone JBL Tune", url: "exemplo.com.br/novo", description: "" });
    expect(edited).toMatchObject({ title: "Fone JBL Tune", url: "https://exemplo.com.br/novo", description: null });

    await deleteGift(u.id, g.id);
    expect(await listMyGifts(u.id)).toHaveLength(0);
  });

  it("recusa URL inválida ou perigosa", async () => {
    const u = await createUser();
    await expect(createGift(u.id, { title: "X", url: "javascript:alert(1)" })).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(createGift(u.id, { title: "Livro", url: "isso não é link" })).rejects.toMatchObject({ code: "VALIDATION" });
    expect(await prisma.gift.count()).toBe(0);
  });

  it("impede editar ou excluir presentes de outra pessoa", async () => {
    const dona = await createUser();
    const intrusa = await createUser();
    const g = await createGift(dona.id, { title: "Livro", url: "https://livraria.com/x" });

    await expect(updateGift(intrusa.id, g.id, { title: "Hackeado", url: "https://mal.com" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(deleteGift(intrusa.id, g.id)).rejects.toMatchObject({ code: "NOT_FOUND" });

    const still = await prisma.gift.findUniqueOrThrow({ where: { id: g.id } });
    expect(still.title).toBe("Livro");
  });

  it("qualquer pessoa vê os presentes públicos de outro participante", async () => {
    const u = await createUser({ name: "Carla Dias" });
    await createGift(u.id, { title: "Caneca", url: "https://loja.com/caneca" });
    const profile = await getParticipantWithGifts(u.id);
    expect(profile?.name).toBe("Carla Dias");
    expect(profile?.gifts.map((g) => g.title)).toEqual(["Caneca"]);
    // E-mail não faz parte do perfil público.
    expect(profile).not.toHaveProperty("email");
  });
});

describe("participantes (home)", () => {
  it("lista só contas verificadas, em ordem alfabética, sem e-mail", async () => {
    await createUser({ name: "Zeca" });
    await createUser({ name: "Ana" });
    await createUser({ name: "Bruno" });
    await createUser({ name: "Não Verificado", verified: false });
    const r = await listParticipants({});
    expect(r.items.map((i) => i.name)).toEqual(["Ana", "Bruno", "Zeca"]);
    expect(r.items[0]).not.toHaveProperty("email");
  });

  it("busca ignora acentos e maiúsculas", async () => {
    await createUser({ name: "João Pedro" });
    await createUser({ name: "Maria" });
    expect((await listParticipants({ q: "JOAO" })).items.map((i) => i.name)).toEqual(["João Pedro"]);
  });

  it("pagina resultados e conta presentes", async () => {
    for (let i = 0; i < 30; i++) await createUser({ name: `Pessoa ${String(i).padStart(2, "0")}` });
    const first = await prisma.user.findFirstOrThrow({ where: { name: "Pessoa 00" } });
    await createGift(first.id, { title: "Livro", url: "https://a.com" });

    const p1 = await listParticipants({ page: 1, pageSize: 24 });
    const p2 = await listParticipants({ page: 2, pageSize: 24 });
    expect(p1.items).toHaveLength(24);
    expect(p2.items).toHaveLength(6);
    expect(p1.pageCount).toBe(2);
    expect(p1.items[0]).toMatchObject({ name: "Pessoa 00", giftCount: 1 });
  });
});

describe("conta", () => {
  it("atualiza o nome com validação", async () => {
    const u = await createUser();
    await updateMyName(u.id, "  Nome   Novo ");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).name).toBe("Nome Novo");
    await expect(updateMyName(u.id, "")).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("exclui a conta e os dados ligados a ela", async () => {
    const u = await createUser();
    await createGift(u.id, { title: "Livro", url: "https://a.com" });
    await deleteMyAccount(u.id);
    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.gift.count()).toBe(0);
  });
});
