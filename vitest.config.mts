import path from "node:path";
import { defineConfig } from "vitest/config";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://laco:laco_dev_password@localhost:5434/laco_test?schema=public";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // "server-only" bloqueia import fora do servidor Next; nos testes (Node puro) é um no-op.
      "server-only": path.resolve(import.meta.dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    // Os testes de integração compartilham o banco de teste: um arquivo por vez.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: TEST_DATABASE_URL,
      APP_URL: "http://localhost:3000",
      APP_SECRET: "test-secret-for-automated-tests-only-0123456789",
      MAIL_TRANSPORT: "console",
      MAIL_FROM: "Laço <teste@localhost>",
      ORGANIZER_EMAILS: "organizadora@teste.dev",
    },
  },
});
