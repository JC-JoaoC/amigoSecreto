-- Troca o login por código de e-mail por login com senha.
-- login_codes guardava só códigos temporários (expiravam em 10 min): pode ser apagada.

-- CreateEnum
CREATE TYPE "TokenPurpose" AS ENUM ('RESET_PASSWORD', 'VERIFY_EMAIL');

-- DropForeignKey
ALTER TABLE "login_codes" DROP CONSTRAINT "login_codes_user_id_fkey";

-- DropIndex
DROP INDEX "users_email_verified_at_search_name_idx";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "password_hash" VARCHAR(255);

-- DropTable
DROP TABLE "login_codes";

-- CreateTable
CREATE TABLE "auth_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "purpose" "TokenPurpose" NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_tokens_token_hash_key" ON "auth_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "auth_tokens_user_id_purpose_idx" ON "auth_tokens"("user_id", "purpose");

-- CreateIndex
CREATE INDEX "users_search_name_idx" ON "users"("search_name");

-- AddForeignKey
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

