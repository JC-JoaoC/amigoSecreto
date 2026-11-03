import type { Metadata } from "next";
import Link from "next/link";
import { MyGifts } from "@/components/gifts/my-gifts";
import { Container, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/server/auth/current-user";
import { listMyGifts } from "@/server/services/gifts";

export const metadata: Metadata = { title: "Meus presentes" };

export default async function MyGiftsPage({ searchParams }: { searchParams: Promise<{ "bem-vindo"?: string }> }) {
  const user = await requireUser("/meus-presentes");
  const [gifts, sp] = await Promise.all([listMyGifts(user.id), searchParams]);

  return (
    <Container className="max-w-4xl py-10 sm:py-14">
      {sp["bem-vindo"] && (
        <div aria-live="polite" className="mb-8 animate-rise rounded-panel bg-pine-50 px-5 py-4">
          <p className="font-medium text-ink">Conta criada. Agora monte sua lista de desejos.</p>
          <p className="mt-0.5 text-[15px] text-ink-2">
            Depois, veja os{" "}
            <Link href="/sorteios" className="font-medium text-ink underline underline-offset-4">
              sorteios abertos
            </Link>{" "}
            e entre no da sua turma.
          </p>
        </div>
      )}
      <PageHeader
        title="Meus presentes"
        description="O que você gostaria de ganhar. Sua lista aparece para todos os participantes, inclusive para quem te tirar."
      />
      <MyGifts gifts={gifts.map((g) => ({ id: g.id, title: g.title, url: g.url, description: g.description }))} />
    </Container>
  );
}
