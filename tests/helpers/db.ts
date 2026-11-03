import { prisma } from "@/server/db";
import { toSearchText } from "@/lib/text";

/** Limpa todas as tabelas (TRUNCATE não dispara os triggers de linha). */
export async function resetDb() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "draw_messages", "draw_results", "draw_participants", "draws", "gifts", "sessions", "login_codes", "rate_limits", "users" RESTART IDENTITY CASCADE',
  );
}

let seq = 0;

export async function createUser(opts: { name?: string; email?: string; verified?: boolean; organizer?: boolean } = {}) {
  seq++;
  const name = opts.name ?? `Pessoa ${String(seq).padStart(3, "0")}`;
  return prisma.user.create({
    data: {
      name,
      searchName: toSearchText(name),
      email: opts.email ?? `pessoa${seq}-${Date.now()}@teste.dev`,
      emailVerifiedAt: opts.verified === false ? null : new Date(),
      role: opts.organizer ? "ORGANIZER" : "USER",
    },
  });
}

export const actorOf = (u: { id: string; role: "USER" | "ORGANIZER" }) => ({ id: u.id, role: u.role });
