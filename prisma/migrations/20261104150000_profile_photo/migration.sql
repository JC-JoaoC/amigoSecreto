-- Foto de perfil opcional (imagem guardada em tabela própria).

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatar_updated_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "user_avatars" (
    "user_id" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "mime_type" VARCHAR(32) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_avatars_pkey" PRIMARY KEY ("user_id")
);

-- AddForeignKey
ALTER TABLE "user_avatars" ADD CONSTRAINT "user_avatars_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

