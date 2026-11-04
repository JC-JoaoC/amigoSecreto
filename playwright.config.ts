import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
export const E2E_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://laco:laco_dev_password@localhost:5434/laco_test?schema=public";
export const E2E_OUTBOX = ".mail-outbox/e2e";
export const E2E_ORGANIZER_EMAIL = "organizador-e2e@teste.dev";

export default defineConfig({
  testDir: "tests/e2e",
  // Os cenários compartilham o banco de teste: execução em série.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "pt-BR",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npx next dev --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
    env: {
      DATABASE_URL: E2E_DATABASE_URL,
      APP_URL: `http://localhost:${PORT}`,
      APP_SECRET: "e2e-secret-for-automated-tests-only-0123456789",
      MAIL_TRANSPORT: "console",
      MAIL_OUTBOX_DIR: E2E_OUTBOX,
      ORGANIZER_EMAILS: E2E_ORGANIZER_EMAIL,
      // Sem acessar lojas de verdade nos testes (a busca é testada com uma internet de mentira).
      PRODUCT_IMAGE_FETCH: "off",
    },
  },
});
