import sharp from "sharp";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { getAvatar, removeAvatar, setAvatar } from "@/server/services/avatars";
import { deleteMyAccount, listParticipants } from "@/server/services/users";
import { createUser, resetDb } from "../helpers/db";

beforeEach(resetDb);

/** Foto de teste retangular com metadado EXIF (que precisa sumir). */
async function photo(width = 1200, height = 800) {
  return sharp({ create: { width, height, channels: 3, background: "#b8232f" } })
    .jpeg()
    .withMetadata({ exif: { IFD0: { Copyright: "dado-sensivel", Artist: "Fulano" } } })
    .toBuffer();
}

describe("foto de perfil", () => {
  it("reprocessa: vira WebP quadrado 256x256, sem metadados", async () => {
    const u = await createUser();
    const { avatarUpdatedAt } = await setAvatar(u.id, await photo());
    const saved = await getAvatar(u.id);
    expect(saved?.mimeType).toBe("image/webp");
    const meta = await sharp(Buffer.from(saved!.data)).metadata();
    expect(meta.format).toBe("webp");
    expect([meta.width, meta.height]).toEqual([256, 256]);
    expect(meta.exif).toBeUndefined();
    expect(Buffer.from(saved!.data).toString("latin1")).not.toContain("dado-sensivel");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).avatarUpdatedAt).toEqual(avatarUpdatedAt);
  });

  it("recusa arquivos que não são imagem, vazios ou grandes demais", async () => {
    const u = await createUser();
    await expect(setAvatar(u.id, Buffer.from("<svg onload=alert(1)>"))).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(setAvatar(u.id, Buffer.from("isso é um texto qualquer"))).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(setAvatar(u.id, Buffer.alloc(0))).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(setAvatar(u.id, Buffer.alloc(6 * 1024 * 1024))).rejects.toMatchObject({ code: "VALIDATION" });
    expect(await getAvatar(u.id)).toBeNull();
  });

  it("trocar a foto muda a versão do endereço", async () => {
    const u = await createUser();
    const a = await setAvatar(u.id, await photo());
    await new Promise((r) => setTimeout(r, 5));
    const b = await setAvatar(u.id, await photo(600, 900));
    expect(b.avatarUpdatedAt.getTime()).toBeGreaterThan(a.avatarUpdatedAt.getTime());
    const list = await listParticipants({});
    expect(list.items[0].avatarUrl).toBe(`/api/avatar/${u.id}?v=${b.avatarUpdatedAt.getTime()}`);
  });

  it("remover volta às iniciais (sem foto)", async () => {
    const u = await createUser();
    await setAvatar(u.id, await photo());
    await removeAvatar(u.id);
    expect(await getAvatar(u.id)).toBeNull();
    expect((await listParticipants({})).items[0].avatarUrl).toBeNull();
  });

  it("excluir a conta apaga a foto junto", async () => {
    const u = await createUser();
    await setAvatar(u.id, await photo());
    await deleteMyAccount(u.id);
    expect(await prisma.userAvatar.count()).toBe(0);
  });
});
