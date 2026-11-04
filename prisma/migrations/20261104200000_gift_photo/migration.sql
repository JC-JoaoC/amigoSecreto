-- Foto do produto nos presentes (opcional, guardada em tabela própria).

-- AlterTable
ALTER TABLE "gifts" ADD COLUMN     "image_updated_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "gift_images" (
    "gift_id" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "mime_type" VARCHAR(32) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gift_images_pkey" PRIMARY KEY ("gift_id")
);

-- AddForeignKey
ALTER TABLE "gift_images" ADD CONSTRAINT "gift_images_gift_id_fkey" FOREIGN KEY ("gift_id") REFERENCES "gifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

