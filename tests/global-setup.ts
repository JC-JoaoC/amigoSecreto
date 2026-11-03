import { execSync } from "node:child_process";

/** Aplica as migrations no banco de teste antes de rodar a suíte. */
export default function setup() {
  const url =
    process.env.TEST_DATABASE_URL ?? "postgresql://laco:laco_dev_password@localhost:5434/laco_test?schema=public";
  execSync("npx prisma migrate deploy", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: url },
  });
}
