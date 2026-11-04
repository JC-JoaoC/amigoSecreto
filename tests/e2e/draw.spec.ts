import { expect, test } from "@playwright/test";
import { E2E_ORGANIZER_PASSWORD } from "./global-setup";
import { loginAs, runTag, seedGift, seedUser } from "./helpers";

const ORGANIZER = "organizador-e2e@teste.dev";

test("organizador cria e realiza sorteio; participante revela só o próprio resultado", async ({ page, browser, baseURL }) => {
  const tag = runTag().replace(/\d/g, "k");
  const people = [
    await seedUser(`Ana ${tag}`, `ana-${tag}@teste.dev`),
    await seedUser(`Bruno ${tag}`, `bruno-${tag}@teste.dev`),
    await seedUser(`Carla ${tag}`, `carla-${tag}@teste.dev`),
  ];
  for (const p of people) await seedGift(p.id, `Livro favorito de ${p.name}`, "https://livraria.exemplo.com/livro");

  // Organizador entra pelo fluxo real de e-mail e senha
  await page.goto("/entrar?next=/sorteios");
  await page.getByLabel("E-mail").fill(ORGANIZER);
  await page.getByLabel("Senha", { exact: true }).fill(E2E_ORGANIZER_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/sorteios$/);

  // Cria o sorteio
  await page.getByRole("button", { name: "Novo sorteio" }).first().click();
  const form = page.getByRole("dialog", { name: "Novo sorteio" });
  await form.getByLabel("Nome do sorteio").fill(`Natal ${tag}`);
  await form.getByLabel(/Valor sugerido/).fill("R$ 100");
  await form.getByRole("button", { name: "Criar sorteio" }).click();
  await expect(page).toHaveURL(/\/sorteios\/[a-z0-9]+$/);
  await expect(page.getByRole("heading", { name: `Natal ${tag}`, level: 1 })).toBeVisible();

  // Sem participantes suficientes, não dá para sortear
  await expect(page.getByRole("button", { name: "Realizar sorteio" })).toBeDisabled();

  // Adiciona os 3 participantes
  await page.getByRole("button", { name: "Adicionar participantes" }).click();
  const add = page.getByRole("dialog", { name: "Adicionar participantes" });
  await add.getByRole("searchbox", { name: "Buscar pelo nome" }).fill(tag);
  for (const p of people) await expect(add.getByText(p.name)).toBeVisible();
  await add.getByRole("button", { name: "Selecionar todas" }).click();
  await add.getByRole("button", { name: "Adicionar (3)" }).click();
  await expect(page.getByText("3 participantes adicionados.")).toBeVisible();
  for (const p of people) await expect(page.getByRole("link", { name: p.name })).toBeVisible();

  // Realiza com confirmação
  await page.getByRole("button", { name: "Realizar sorteio" }).click();
  const confirm = page.getByRole("dialog", { name: "Realizar o sorteio agora?" });
  await expect(confirm).toContainText("3 participantes");
  await confirm.getByRole("button", { name: "Sim, sortear" }).click();
  await expect(page.getByText(/Sorteio realizado! Cada participante/)).toBeVisible();
  await expect(page.getByText("Sorteio realizado", { exact: true })).toBeVisible();
  await expect(page.getByText("Já abriram o papel")).toBeVisible();
  await expect(page.getByText("0 de 3", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Realizar sorteio" })).toHaveCount(0);

  // Participante (Ana) em outra sessão
  const ctx = await browser.newContext({ viewport: page.viewportSize(), locale: "pt-BR" });
  await loginAs(ctx, people[0].id, baseURL!);
  const ana = await ctx.newPage();
  await ana.goto("/meu-resultado");
  await expect(ana.getByRole("heading", { name: `Natal ${tag}` })).toBeVisible();

  // Antes de clicar, o nome sorteado NÃO está no HTML
  const html = await ana.content();
  expect(html).not.toContain(people[1].name);
  expect(html).not.toContain(people[2].name);

  await ana.getByRole("button", { name: "Abrir meu papel" }).click();
  await expect(ana.getByText("Você tirou", { exact: true })).toBeVisible();
  const drawn = (await ana.getByTestId("receiver-name").textContent())?.trim();
  expect([people[1].name, people[2].name]).toContain(drawn); // nunca a si mesma
  await expect(ana.getByText("Agora é segredo. Não conte para ninguém.")).toBeVisible();

  await ana.getByRole("link", { name: "Ver lista de presentes" }).click();
  await expect(ana.getByRole("heading", { name: drawn!, level: 1 })).toBeVisible();
  await expect(ana.getByText(`Livro favorito de ${drawn}`)).toBeVisible();

  // Mensagem anônima para quem ela tirou
  await ana.goto("/meu-resultado");
  await ana.getByLabel("Mensagem para quem você tirou").fill("Você prefere livro ou vinho?");
  await ana.getByRole("button", { name: "Enviar anônimo" }).click();
  await expect(ana.getByText("Mensagem enviada anonimamente.")).toBeVisible();
  await expect(ana.getByLabel("Mensagem para quem você tirou")).toHaveValue("");
  await expect(ana.getByRole("list", { name: "Mensagens" }).getByText("Você prefere livro ou vinho?")).toBeVisible();

  // A pessoa sorteada vê a mensagem (sem saber de quem é) e responde
  const receiver = people.find((p) => p.name === drawn)!;
  const ctxR = await browser.newContext({ viewport: page.viewportSize(), locale: "pt-BR" });
  await loginAs(ctxR, receiver.id, baseURL!);
  const rec = await ctxR.newPage();
  await rec.goto("/meu-resultado");
  await expect(rec.getByRole("tab", { name: "Quem me tirou" })).toHaveAttribute("aria-selected", "true");
  await expect(rec.getByRole("list", { name: "Mensagens" }).getByText("Você prefere livro ou vinho?")).toBeVisible();
  expect(await rec.content()).not.toContain(people[0].name); // nada identifica a Ana
  await rec.getByLabel("Mensagem para o seu amigo secreto").fill("Livro, por favor!");
  await rec.getByRole("button", { name: "Enviar anônimo" }).click();
  await expect(rec.getByText("Mensagem enviada anonimamente.")).toBeVisible();
  await expect(rec.getByRole("list", { name: "Mensagens" }).getByText("Livro, por favor!")).toBeVisible();
  await ctxR.close();

  await ana.reload();
  await expect(ana.getByRole("list", { name: "Mensagens" }).getByText("Livro, por favor!")).toBeVisible();
  await ctx.close();

  // Organizador vê só a contagem de quem já revelou
  await page.reload();
  await expect(page.getByText("1 de 3", { exact: true })).toBeVisible();
  expect(await page.content()).not.toContain(`Você tirou`);
});

test("participante entra e sai de um sorteio aberto", async ({ page, context, baseURL }) => {
  const tag = runTag().replace(/\d/g, "q");
  const user = await seedUser(`Davi ${tag}`, `davi-${tag}@teste.dev`);
  const org = await seedUser(`Org ${tag}`, `org-${tag}@teste.dev`, "ORGANIZER");

  // organizador cria o sorteio
  await loginAs(context, org.id, baseURL!);
  await page.goto("/sorteios");
  await page.getByRole("button", { name: "Novo sorteio" }).first().click();
  await page.getByRole("dialog", { name: "Novo sorteio" }).getByLabel("Nome do sorteio").fill(`Firma ${tag}`);
  await page.getByRole("button", { name: "Criar sorteio" }).click();
  await expect(page).toHaveURL(/\/sorteios\/[a-z0-9]+$/);
  const drawUrl = page.url();
  await context.clearCookies();

  // usuário comum entra
  await loginAs(context, user.id, baseURL!);
  await page.goto("/sorteios");
  await expect(page.getByRole("button", { name: "Novo sorteio" })).toHaveCount(0); // sem permissão de organizador
  await page.goto(drawUrl);
  await page.getByRole("button", { name: "Quero participar" }).click();
  await expect(page.getByText("Você está participando!")).toBeVisible();
  await expect(page.getByRole("link", { name: `Davi ${tag}` })).toBeVisible();
  await expect(page.getByRole("button", { name: "Realizar sorteio" })).toHaveCount(0);

  await page.getByRole("button", { name: "Sair do sorteio" }).click();
  await page.getByRole("dialog", { name: "Sair deste sorteio?" }).getByRole("button", { name: "Sair do sorteio" }).click();
  await expect(page.getByText("Você saiu deste sorteio.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Quero participar" })).toBeVisible();
});
