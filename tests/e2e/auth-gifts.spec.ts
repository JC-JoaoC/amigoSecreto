import { expect, test } from "@playwright/test";
import { readLoginCode, runTag } from "./helpers";

test.describe("cadastro, login e meus presentes", () => {
  test("validação do cadastro mostra mensagens amigáveis", async ({ page }) => {
    await page.goto("/cadastro");
    await page.getByRole("button", { name: "Criar conta e receber código" }).click();
    await expect(page.getByText("Informe seu nome completo.")).toBeVisible();
    await expect(page.getByText("Informe seu e-mail.")).toBeVisible();
    await page.getByLabel("Nome completo").fill("<script>alert(1)</script>");
    await page.getByLabel("E-mail").fill("ana@");
    await page.getByRole("button", { name: "Criar conta e receber código" }).click();
    await expect(page.getByText("Use apenas letras, espaços, hífen ou apóstrofo.")).toBeVisible();
    await expect(page.getByText(/Digite um e-mail válido/)).toBeVisible();
  });

  test("e-mail não cadastrado oferece criar conta", async ({ page }) => {
    const email = `nao-existe-${runTag()}@teste.dev`;
    await page.goto("/entrar");
    await page.getByLabel("Seu e-mail").fill(email);
    await page.getByRole("button", { name: "Receber código de acesso" }).click();
    await expect(page.getByText("Não encontramos uma conta com")).toBeVisible();
    await page.getByRole("link", { name: "Criar conta com este e-mail" }).click();
    await expect(page).toHaveURL(/\/cadastro\?email=/);
    await expect(page.getByLabel("E-mail")).toHaveValue(email);
  });

  test("fluxo completo: cadastro → código → presentes (adicionar, editar, excluir) → sair", async ({ page }) => {
    const tag = runTag();
    const email = `Pessoa.${tag}@Teste.dev`;
    const name = `Teste Pessoa ${tag.replace(/\d/g, "x")}`;

    // Cadastro
    await page.goto("/cadastro");
    const since = Date.now() - 1000;
    await page.getByLabel("Nome completo").fill(name);
    await page.getByLabel("E-mail").fill(email);
    await page.getByRole("button", { name: "Criar conta e receber código" }).click();
    await expect(page.getByText(/^Enviamos um código de 6 dígitos/)).toBeVisible();

    // Código errado, depois o certo (e-mail foi normalizado para minúsculas)
    const code = await readLoginCode(email.toLowerCase(), since);
    const wrong = code === "000000" ? "111111" : "000000";
    await page.getByLabel("Código de acesso").fill(wrong);
    await expect(page.getByText(/Código incorreto/)).toBeVisible();
    await page.getByLabel("Código de acesso").fill(code);

    await expect(page).toHaveURL(/\/meus-presentes\?bem-vindo=1/);
    await expect(page.getByText("Conta criada. Agora monte sua lista de desejos.")).toBeVisible();
    await expect(page.getByText("Sua lista está vazia")).toBeVisible();

    // Adicionar presente com URL perigosa → erro; depois válida
    await page.getByRole("button", { name: "Adicionar presente" }).click();
    const dialog = page.getByRole("dialog", { name: "Adicionar presente" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Nome do presente").fill("Fone Bluetooth JBL");
    await dialog.getByLabel("Link do produto").fill("javascript:alert(1)");
    await dialog.getByRole("button", { name: "Adicionar presente" }).click();
    await expect(dialog.getByText("Use um link válido começando com https://")).toBeVisible();
    await dialog.getByLabel("Link do produto").fill("https://www.exemplo.com.br/produto");
    await dialog.getByLabel(/Descrição/).fill("Preferencialmente na cor preta");
    await dialog.getByRole("button", { name: "Adicionar presente" }).click();
    await expect(page.getByText("Presente adicionado à sua lista!")).toBeVisible();
    await expect(dialog).toBeHidden();
    const card = page.getByRole("listitem").filter({ hasText: "Fone Bluetooth JBL" });
    await expect(card).toBeVisible();
    await expect(card.getByText("Preferencialmente na cor preta")).toBeVisible();
    const link = card.getByRole("link", { name: /Ver na loja/ });
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);

    // Editar
    await page.getByRole("button", { name: "Editar Fone Bluetooth JBL" }).click();
    const edit = page.getByRole("dialog", { name: "Editar presente" });
    await edit.getByLabel("Nome do presente").fill("Fone JBL Tune 520");
    await edit.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByText("Presente atualizado.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Fone JBL Tune 520" })).toBeVisible();

    // Aparece na página pública
    await page.goto("/");
    await page.getByRole("searchbox", { name: "Buscar participante pelo nome" }).fill(name);
    const me = page.getByRole("listitem").filter({ hasText: name });
    await expect(me.getByText("Você")).toBeVisible();
    await expect(me.getByText("1 presente")).toBeVisible();
    await me.getByRole("link", { name: /Ver presentes/ }).click();
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Fone JBL Tune 520" })).toBeVisible();

    // Excluir com confirmação
    await page.goto("/meus-presentes");
    await page.getByRole("button", { name: "Excluir Fone JBL Tune 520" }).click();
    const confirm = page.getByRole("dialog", { name: "Excluir presente?" });
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Excluir" }).click();
    await expect(page.getByText("Presente removido da lista.")).toBeVisible();
    await expect(page.getByText("Sua lista está vazia")).toBeVisible();

    // Sair
    const isMobile = (page.viewportSize()?.width ?? 1200) < 1024;
    if (isMobile) await page.getByRole("button", { name: "Abrir menu" }).click();
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page.getByText("Você saiu da sua conta.")).toBeVisible();
    await page.goto("/meus-presentes");
    await expect(page).toHaveURL(/\/entrar/);
  });
});
