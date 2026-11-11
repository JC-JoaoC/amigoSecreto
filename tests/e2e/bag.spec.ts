import { expect, test } from "@playwright/test";
import { loginAs, runTag, seedUser } from "./helpers";

test("sorteio do saco: organizador define o último, tira os nomes e o marcado sobra", async ({ page, browser, context, baseURL }) => {
  const tag = runTag().replace(/\d/g, "s");
  const org = await seedUser(`Org Saco ${tag}`, `org-saco-${tag}@teste.dev`, "ORGANIZER");
  const people = [
    await seedUser(`Ana ${tag}`, `ana-saco-${tag}@teste.dev`),
    await seedUser(`Bruno ${tag}`, `bruno-saco-${tag}@teste.dev`),
    await seedUser(`Carla ${tag}`, `carla-saco-${tag}@teste.dev`),
    await seedUser(`Davi ${tag}`, `davi-saco-${tag}@teste.dev`),
  ];
  const chosen = people[2];
  const outsider = await seedUser(`Fora ${tag}`, `fora-saco-${tag}@teste.dev`);

  await loginAs(context, org.id, baseURL!);
  await page.goto("/saco");
  await expect(page.getByRole("heading", { name: "Sorteio do saco", level: 1 })).toBeVisible();

  // Cria
  await page.getByRole("button", { name: "Novo sorteio do saco" }).first().click();
  const form = page.getByRole("dialog", { name: "Novo sorteio do saco" });
  await form.getByLabel("Nome do sorteio").fill(`Festa ${tag}`);
  await form.getByRole("button", { name: "Criar sorteio" }).click();
  await expect(page).toHaveURL(/\/saco\/[a-z0-9]+$/);
  const bagUrl = page.url();
  await expect(page.getByRole("heading", { name: `Festa ${tag}`, level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tirar o primeiro nome" })).toBeDisabled();

  // Coloca 4 pessoas no saco
  await page.getByRole("button", { name: "Colocar pessoas no saco" }).click();
  const add = page.getByRole("dialog", { name: "Colocar pessoas no saco" });
  await add.getByRole("searchbox", { name: "Buscar pelo nome" }).fill(tag);
  for (const p of people) await expect(add.getByText(p.name)).toBeVisible();
  // Só os 4 participantes (o organizador e quem fica de fora têm outro nome)
  for (const p of people) await add.getByText(p.name).click();
  await add.getByRole("button", { name: "Adicionar (4)" }).click();
  await expect(page.getByText("4 participantes adicionados.")).toBeVisible();

  // Define quem fica por último (não aparece no painel)
  await page.getByRole("button", { name: "Definir o último nome" }).click();
  const last = page.getByRole("dialog", { name: "Quem fica por último no saco?" });
  await last.getByText(chosen.name).click();
  await last.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Configuração salva.")).toBeVisible();

  // Começa com confirmação
  await page.getByRole("button", { name: "Tirar o primeiro nome" }).click();
  const confirm = page.getByRole("dialog", { name: "Começar a tirar nomes?" });
  await expect(confirm).toContainText("4 pessoas");
  await confirm.getByRole("button", { name: "Sim, tirar o primeiro" }).click();

  // O nome sai do saco num modal
  const reveal = page.getByRole("dialog", { name: /^Saiu do saco: / });
  await expect(reveal.getByText("Saiu do saco · 1º nome")).toBeVisible();
  await expect(reveal.getByText("Ainda 3 no saco.")).toBeVisible();
  await reveal.getByRole("button", { name: "Fechar" }).first().click();
  await expect(reveal).toHaveCount(0);
  await expect(page.getByText("Último a sair · 1º nome")).toBeVisible();
  await expect(page.getByText("Tirando nomes", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Colocar pessoas no saco" })).toHaveCount(0);

  // Participante acompanhando de outro aparelho (antes do fim)
  const ctx = await browser.newContext({ viewport: page.viewportSize(), locale: "pt-BR" });
  await loginAs(ctx, people[0].id, baseURL!);
  const ana = await ctx.newPage();
  await ana.goto(bagUrl);
  await expect(ana.getByText("Último a sair · 1º nome")).toBeVisible();
  await expect(ana.getByRole("dialog", { name: /^Saiu do saco: / })).toHaveCount(0); // ao carregar, não abre
  await expect(ana.getByRole("button", { name: /Tirar/ })).toHaveCount(0);
  await expect(ana.getByRole("button", { name: "Definir o último nome" })).toHaveCount(0);

  // Tira o 2º pela página e o 3º sem sair do modal
  await page.getByRole("button", { name: "Tirar próximo nome" }).click();
  await expect(reveal.getByText("Saiu do saco · 2º nome")).toBeVisible();
  await reveal.getByRole("button", { name: "Tirar próximo nome" }).click();
  await expect(reveal.getByText("Saiu do saco · 3º nome")).toBeVisible();
  await expect(reveal.getByText("Só sobrou 1 nome no saco…")).toBeVisible();
  await expect(reveal.getByTestId("bag-reveal-name")).not.toHaveText(chosen.name);

  // Quem foi marcado sobra no saco e ganha
  await reveal.getByRole("button", { name: "Revelar quem ficou" }).click();
  const winnerReveal = page.getByRole("dialog", { name: /^Ficou por último no saco: / });
  await expect(winnerReveal.getByTestId("bag-reveal-name")).toHaveText(chosen.name);
  await expect(winnerReveal.getByText("Ganhou!")).toBeVisible();
  await winnerReveal.getByRole("button", { name: "Fechar" }).first().click();
  await expect(page.getByTestId("bag-winner-name")).toHaveText(chosen.name);
  await expect(page.getByText("Sorteio concluído", { exact: true })).toBeVisible();
  const order = page.getByRole("region", { name: /Ordem de saída/ }).getByRole("listitem");
  await expect(order).toHaveCount(3);
  await expect(page.getByRole("region", { name: /Ordem de saída/ })).not.toContainText(chosen.name);

  // A tela do participante se atualiza sozinha e também abre a revelação
  await expect(ana.getByTestId("bag-winner-name")).toHaveText(chosen.name, { timeout: 15_000 });
  await expect(ana.getByRole("dialog", { name: /^Saiu do saco: / })).toBeVisible();
  await expect(ana.getByRole("dialog").getByRole("button", { name: /Tirar/ })).toHaveCount(0);
  await ana.goto("/saco");
  await expect(ana.getByText(`Festa ${tag}`)).toBeVisible();
  await expect(ana.getByRole("button", { name: "Novo sorteio do saco" })).toHaveCount(0);
  await ctx.close();

  // Quem não está no saco não vê o sorteio
  const ctxOut = await browser.newContext({ viewport: page.viewportSize(), locale: "pt-BR" });
  await loginAs(ctxOut, outsider.id, baseURL!);
  const out = await ctxOut.newPage();
  // (com loading.tsx a resposta é transmitida em streaming, então o status HTTP já saiu como 200)
  await out.goto(bagUrl);
  await expect(out.getByText("Não encontramos esta página")).toBeVisible();
  expect(await out.content()).not.toContain(`Festa ${tag}`);
  await ctxOut.close();
});
