import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { loginAs, runTag, seedUser } from "./helpers";

test("foto de perfil: escolher, pré-visualizar, salvar, aparecer no site e remover", async ({ page, context, baseURL }) => {
  const tag = runTag().replace(/\d/g, "f");
  const u = await seedUser(`Foto ${tag}`, `foto-${tag}@teste.dev`, "USER", "senha-boa-e2e-123");
  await loginAs(context, u.id, baseURL!);
  // Dentro do conteúdo da página (o avatar do menu do desktop fica oculto no celular).
  const mine = page.locator("main").locator(`img[src^="/api/avatar/${u.id}"]`);

  await page.goto("/conta");
  const png = await sharp({ create: { width: 900, height: 600, channels: 3, background: "#1f5039" } }).png().toBuffer();
  await page.getByTestId("avatar-input").setInputFiles({ name: "minha-foto.png", mimeType: "image/png", buffer: png });
  await expect(page.getByAltText("Pré-visualização da nova foto")).toBeVisible();
  await page.getByRole("button", { name: "Salvar foto" }).click();
  await expect(page.getByText("Foto de perfil atualizada.")).toBeVisible();

  // A foto é servida pelo próprio site, já convertida
  await expect(mine.first()).toBeVisible();
  const res = await page.request.get((await mine.first().getAttribute("src"))!);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("image/webp");

  // E aparece na lista de participantes
  await page.goto(`/?q=${encodeURIComponent(`Foto ${tag}`)}`);
  await expect(mine.first()).toBeVisible();

  // Remover (com confirmação) volta às iniciais
  await page.goto("/conta");
  await page.getByRole("button", { name: "Remover foto" }).click();
  await page.getByRole("dialog", { name: "Remover sua foto?" }).getByRole("button", { name: "Remover foto" }).click();
  await expect(page.getByText("Foto removida.")).toBeVisible();
  await expect(mine).toHaveCount(0);
});
