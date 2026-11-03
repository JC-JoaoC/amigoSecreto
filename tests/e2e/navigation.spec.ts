import { expect, test } from "@playwright/test";

test.describe("navegação e páginas públicas", () => {
  test("home pública mostra chamada e participantes", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Seu Amigo Secreto");
    await expect(page.getByText("Conheça seus amigos, descubra o que eles gostariam de ganhar")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Participantes" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Criar minha conta" }).first()).toBeVisible();
    // Organizador semeado aparece na lista, sem e-mail exposto.
    await expect(page.getByRole("link", { name: /Olívia Organizadora/ })).toBeVisible();
    expect(await page.content()).not.toContain("organizador-e2e@teste.dev");
  });

  test("busca por nome ignora acentos", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("searchbox", { name: "Buscar participante pelo nome" }).fill("olivia");
    await expect(page).toHaveURL(/q=olivia/);
    await expect(page.getByRole("link", { name: /Olívia Organizadora/ })).toBeVisible();
    await page.getByRole("searchbox", { name: "Buscar participante pelo nome" }).fill("zzzninguem");
    await expect(page.getByText("Ninguém com esse nome")).toBeVisible();
  });

  test("páginas privadas redirecionam para o login", async ({ page }) => {
    for (const path of ["/meus-presentes", "/sorteios", "/meu-resultado", "/conta"]) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/entrar\\?next=${encodeURIComponent(path).replace(/[/]/g, "\\/")}`));
      await expect(page.getByRole("heading", { name: "Entrar", level: 1 })).toBeVisible();
    }
  });

  test("cookie de sessão falso não dá acesso", async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "laco_session", value: "falsificado", url: baseURL! }]);
    await page.goto("/meus-presentes");
    await expect(page).toHaveURL(/\/entrar/);
  });

  test("página inexistente mostra 404 amigável", async ({ page }) => {
    const res = await page.goto("/pagina-que-nao-existe");
    expect(res?.status()).toBe(404);
    await expect(page.getByText("Não encontramos esta página")).toBeVisible();
  });

  test("cabeçalhos de segurança estão presentes", async ({ request }) => {
    const res = await request.get("/");
    const h = res.headers();
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-powered-by"]).toBeUndefined();
  });

  test("layout não tem rolagem horizontal", async ({ page }) => {
    for (const path of ["/", "/entrar", "/cadastro", "/privacidade"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });

  test("menu móvel abre e navega", async ({ page, isMobile }) => {
    test.skip(!isMobile, "apenas no celular");
    await page.goto("/");
    const menuButton = page.getByRole("button", { name: "Abrir menu" });
    await expect(menuButton).toBeVisible();
    await menuButton.click();
    const menu = page.locator("#mobile-menu");
    await expect(menu).toBeVisible();
    await menu.getByRole("link", { name: "Criar conta" }).click();
    await expect(page).toHaveURL(/\/cadastro/);
    await expect(menu).toBeHidden();
  });
});
