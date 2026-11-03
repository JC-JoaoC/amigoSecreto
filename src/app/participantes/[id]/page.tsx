import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { GiftCard, GiftList } from "@/components/gifts/gift-card";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { Container, EmptyState } from "@/components/ui/misc";
import { firstName } from "@/lib/text";
import { getCurrentUser } from "@/server/auth/current-user";
import { getParticipantWithGifts } from "@/server/services/users";

type Props = { params: Promise<{ id: string }> };

async function load(id: string) {
  if (!/^[a-z0-9]{1,64}$/i.test(id)) return null;
  return getParticipantWithGifts(id);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await load((await params).id);
  return { title: p ? `Presentes de ${p.name}` : "Participante não encontrado" };
}

export default async function ParticipantPage({ params }: Props) {
  const { id } = await params;
  const [participant, me] = await Promise.all([load(id), getCurrentUser()]);
  if (!participant) notFound();
  const isMe = me?.id === participant.id;
  const count = participant.gifts.length;

  return (
    <Container className="max-w-4xl py-10 sm:py-14">
      <Link href="/#participantes" className="mb-6 inline-flex items-center gap-1 text-[15px] text-ink-2 hover:text-ink">
        <ChevronLeft className="size-4" aria-hidden /> Participantes
      </Link>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center">
        <Avatar name={participant.name} seed={participant.id} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="break-words text-[28px] font-bold leading-tight text-ink">{participant.name}</h1>
          <p className="mt-0.5 text-base text-ink-2">
            {count === 0 ? "Lista de desejos vazia" : `${count} ${count === 1 ? "ideia de presente" : "ideias de presente"}`}
          </p>
        </div>
        {isMe && (
          <ButtonLink href="/meus-presentes" variant="outline">
            Editar minha lista
          </ButtonLink>
        )}
      </div>

      {count > 0 ? (
        <GiftList>
          {participant.gifts.map((g) => (
            <GiftCard key={g.id} gift={g} />
          ))}
        </GiftList>
      ) : (
        <EmptyState
          title={isMe ? "Sua lista está vazia" : `${firstName(participant.name)} ainda não montou a lista`}
          description={isMe ? "Adicione presentes para dar dicas a quem te tirar." : "Volte mais perto da data da troca."}
          action={isMe ? <ButtonLink href="/meus-presentes">Adicionar presentes</ButtonLink> : undefined}
        />
      )}
    </Container>
  );
}
