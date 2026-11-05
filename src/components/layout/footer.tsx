import Link from "next/link";
import { Logo } from "@/components/logo";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line bg-mist">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-start sm:justify-between sm:px-8">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-3 text-[15px] text-ink-2">
            Cada resultado é cifrado no servidor. Entre os participantes, só quem tirou vê o nome. O organizador pode consultar os
            pares e as mensagens.
          </p>
        </div>
        <nav aria-label="Rodapé" className="flex flex-wrap gap-x-6 gap-y-2 text-[15px]">
          <Link href="/" className="text-ink-2 hover:text-ink">Participantes</Link>
          <Link href="/cadastro" className="text-ink-2 hover:text-ink">Criar conta</Link>
          <Link href="/privacidade" className="text-ink-2 hover:text-ink">Privacidade e dados</Link>
        </nav>
      </div>
    </footer>
  );
}
