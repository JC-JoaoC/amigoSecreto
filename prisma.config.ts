import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // `prisma generate` (no install/build) não precisa de banco; migrate/studio precisam.
    url: process.env.DATABASE_URL ?? "",
  },
});
