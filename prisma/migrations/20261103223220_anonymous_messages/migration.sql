-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('TO_RECEIVER', 'TO_GIVER');

-- CreateTable
CREATE TABLE "draw_messages" (
    "id" TEXT NOT NULL,
    "result_id" TEXT NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "body_cipher" TEXT NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "draw_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "draw_messages_result_id_created_at_idx" ON "draw_messages"("result_id", "created_at");

-- AddForeignKey
ALTER TABLE "draw_messages" ADD CONSTRAINT "draw_messages_result_id_fkey" FOREIGN KEY ("result_id") REFERENCES "draw_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;
