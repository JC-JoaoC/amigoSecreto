import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { loginAs, runTag, seedUser } from "./helpers";

test("foto do presente: enviar, ver na lista e na página pública, remover", async ({ page, context, baseURL }) => {
  const tag = runTag().replace(/\d/g, "g");
  const u = await seedUser(`Presente ${tag}`, `presente-${tag}@teste.dev`, "USER", "senha-boa-e2e-123");
  await loginAs(context, u.id, baseURL!);

  await page.goto("/meus-presentes");
  await page.getByRole("button", { name: "Adicionar presente" }).click();
  const dialog = page.getByRole("dialog", { name: "Adicionar presente" });
  await dialog.getByLabel("Link do produto").fill("https://www.exemplo.com.br/caneca-termica");
  await dialog.getByLabel("Nome do presente").fill("Caneca Térmica");

  // Loja fora da lista: não há busca automática, a pessoa envia a foto
  await expect(dialog.getByRole("button", { name: "Buscar na loja" })).toHaveCount(0);
  const png = await sharp({ create: { width: 1400, height: 900, channels: 3, background: "#b8232f" } }).png().toBuffer();
  await page.getByTestId("gift-photo-input").setInputFiles({ name: "caneca.png", mimeType: "image/png", buffer: png });
  await expect(dialog.getByAltText("Foto do produto")).toBeVisible();
  await expect(dialog.getByText("Foto escolhida. Ela é salva junto com o presente.")).toBeVisible();
  await dialog.getByRole("button", { name: "Adicionar presente" }).click();
  await expect(page.getByText("Presente adicionado à sua lista!")).toBeVisible();

  // A foto é servida pelo nosso site, já convertida
  const card = page.getByRole("listitem").filter({ hasText: "Caneca Térmica" });
  const img = card.locator('img[src^="/api/gift-image/"]');
  await expect(img).toBeVisible();
  const res = await page.request.get((await img.getAttribute("src"))!);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("image/webp");

  // Aparece para os outros na página do participante
  await page.goto(`/participantes/${u.id}`);
  await expect(page.getByRole("listitem").filter({ hasText: "Caneca Térmica" }).locator('img[src^="/api/gift-image/"]')).toBeVisible();

  // Remover a foto ao editar
  await page.goto("/meus-presentes");
  await page.getByRole("button", { name: "Editar Caneca Térmica" }).click();
  const edit = page.getByRole("dialog", { name: "Editar presente" });
  await expect(edit.getByText("Foto atual do presente.")).toBeVisible();
  await edit.getByRole("button", { name: "Remover foto" }).click();
  await edit.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText("Presente atualizado.")).toBeVisible();
  await expect(card.locator("img")).toHaveCount(0);
});
