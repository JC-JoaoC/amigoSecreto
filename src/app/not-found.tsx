import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/misc";

export default function NotFound() {
  return (
    <Container className="max-w-2xl py-20">
      <h1 className="text-[28px] font-bold text-ink">Não encontramos esta página</h1>
      <p className="mt-2 text-base text-ink">O link pode estar errado, ou o conteúdo foi removido.</p>
      <ButtonLink href="/" className="mt-6">
        Ir para os participantes
      </ButtonLink>
    </Container>
  );
}
