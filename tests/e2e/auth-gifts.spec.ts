import { expect, test } from "@playwright/test";
import { readMailUrl, runTag, seedUser } from "./helpers";

const PW = "senha-boa-e2e-123";

test.describe("cadastro, login e meus presentes", () => {
  test("validação do cadastro mostra mensagens amigáveis", async ({ page }) => {
    await page.goto("/cadastro");
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.getByText("Informe seu nome completo.")).toBeVisible();
    await expect(page.getByText("Informe seu e-mail.")).toBeVisible();
    await expect(page.getByText("Use pelo menos 8 caracteres.")).toBeVisible();
    await page.getByLabel("Nome completo").fill("<script>alert(1)</script>");
    await page.getByLabel("E-mail").fill("ana@");
    await page.getByLabel("Senha", { exact: true }).fill("12345678");
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.getByText("Use apenas letras, espaços, hífen ou apóstrofo.")).toBeVisible();
    await expect(page.getByText(/Digite um e-mail válido/)).toBeVisible();
    await expect(page.getByText("Essa senha é muito comum. Escolha outra.")).toBeVisible();
  });

  test("senha errada mostra mensagem genérica e oferece recuperar", async ({ page }) => {
    const tag = runTag();
    await seedUser(`Rita ${tag.replace(/\d/g, "r")}`, `rita-${tag}@teste.dev`, "USER", PW);
    await page.goto("/entrar");
    await page.getByLabel("E-mail").fill(`rita-${tag}@teste.dev`);
    await page.getByLabel("Senha", { exact: true }).fill("senha-errada-999");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
    // E-mail que não existe recebe exatamente a mesma resposta
    await page.getByLabel("E-mail").fill(`nao-existe-${tag}@teste.dev`);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Esqueci minha senha" })).toBeVisible();
  });

  test("esqueci minha senha: link no e-mail, nova senha e login", async ({ page }) => {
    const tag = runTag();
    const email = `lu-${tag}@teste.dev`;
    await seedUser(`Lu ${tag.replace(/\d/g, "l")}`, email, "USER", PW);
    await page.goto("/entrar");
    await page.getByLabel("E-mail").fill(email);
    await page.getByRole("link", { name: "Esqueci minha senha" }).click();
    await expect(page).toHaveURL(/\/esqueci-senha\?email=/);
    const since = Date.now() - 1000;
    await page.getByRole("button", { name: "Enviar link para nova senha" }).click();
    await expect(page.getByText("Confira seu e-mail")).toBeVisible();

    const url = new URL(await readMailUrl(email, "password-reset", since));
    await page.goto(url.pathname + url.search);
    await page.getByLabel("Nova senha").fill("nova-senha-e2e-456");
    await page.getByRole("button", { name: "Salvar nova senha" }).click();
    await expect(page.getByText("Nova senha salva. Você já entrou na sua conta.")).toBeVisible();

    // O mesmo link não funciona de novo
    await page.goto(url.pathname + url.search);
    await page.getByLabel("Nova senha").fill("outra-senha-e2e-789");
    await page.getByRole("button", { name: "Salvar nova senha" }).click();
    await expect(page.getByText(/Este link expirou ou já foi usado/)).toBeVisible();
  });

  test("fluxo completo: cadastro com senha → presentes (adicionar, editar, excluir) → sair → entrar", async ({ page }) => {
    const tag = runTag();
    const email = `Pessoa.${tag}@Teste.dev`;
    const name = `Teste Pessoa ${tag.replace(/\d/g, "x")}`;

    // Cadastro já entra na conta
    await page.goto("/cadastro");
    await page.getByLabel("Nome completo").fill(name);
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha", { exact: true }).fill(PW);
    await page.getByRole("button", { name: "Criar conta" }).click();

    await expect(page).toHaveURL(/\/meus-presentes\?bem-vindo=1/);
    await expect(page.getByText("Conta criada. Agora monte sua lista de desejos.")).toBeVisible();
    await expect(page.getByText("Sua lista está vazia")).toBeVisible();

    // Adicionar presente com URL perigosa → erro; depois válida
    await page.getByRole("button", { name: "Adicionar presente" }).click();
    const dialog = page.getByRole("dialog", { name: "Adicionar presente" });
    await expect(dialog).toBeVisible();
    // Colar um link do Mercado Livre preenche o nome sozinho
    await dialog.getByLabel("Link do produto").fill("https://www.mercadolivre.com.br/fone-de-ouvido-jbl-tune-520bt/p/MLB25591473");
    await expect(dialog.getByLabel("Nome do presente")).toHaveValue("Fone de ouvido jbl tune 520bt");
    await expect(dialog.getByText("Nome tirado do link. Ajuste se quiser.")).toBeVisible();
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
    // Espera a busca (com atraso de 300 ms) chegar ao endereço antes de clicar,
    // senão ela pode substituir a navegação do clique.
    await expect(page).toHaveURL(/[?&]q=/);
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
    await expect(page).toHaveURL(/\/entrar\?next=/);

    // Entra de novo com e-mail e senha e volta para onde queria ir
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha", { exact: true }).fill(PW);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/meus-presentes$/);
    await expect(page.getByRole("heading", { name: "Meus presentes", level: 1 })).toBeVisible();
  });
});
