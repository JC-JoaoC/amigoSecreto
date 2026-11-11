-- Sorteio do saco: nomes saem um a um; quem sobra por último ganha.

-- CreateEnum
CREATE TYPE "BagDrawStatus" AS ENUM ('OPEN', 'RUNNING', 'COMPLETED');

-- CreateTable
CREATE TABLE "bag_draws" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "description" VARCHAR(500),
    "status" "BagDrawStatus" NOT NULL DEFAULT 'OPEN',
    "last_user_id" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "bag_draws_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bag_entries" (
    "id" TEXT NOT NULL,
    "bag_draw_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "position" INTEGER,
    "drawn_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bag_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bag_draws_status_created_at_idx" ON "bag_draws"("status", "created_at");

-- CreateIndex
CREATE INDEX "bag_entries_user_id_idx" ON "bag_entries"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "bag_entries_bag_draw_id_user_id_key" ON "bag_entries"("bag_draw_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "bag_entries_bag_draw_id_position_key" ON "bag_entries"("bag_draw_id", "position");

-- AddForeignKey
ALTER TABLE "bag_draws" ADD CONSTRAINT "bag_draws_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bag_draws" ADD CONSTRAINT "bag_draws_last_user_id_fkey" FOREIGN KEY ("last_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bag_entries" ADD CONSTRAINT "bag_entries_bag_draw_id_fkey" FOREIGN KEY ("bag_draw_id") REFERENCES "bag_draws"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bag_entries" ADD CONSTRAINT "bag_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Posição de saída sempre começa em 1.
ALTER TABLE "bag_entries" ADD CONSTRAINT "bag_entries_position_positive" CHECK ("position" IS NULL OR "position" > 0);
