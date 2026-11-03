import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { DataActions, NameForm } from "@/components/account/account-forms";
import { Container, PageHeader } from "@/components/ui/misc";
import { formatDay } from "@/lib/format";
import { requireUser } from "@/server/auth/current-user";
import { getAccount } from "@/server/services/users";

export const metadata: Metadata = { title: "Conta" };

/** Configurações: descrição à esquerda, controle à direita (empilha no celular). */
function Setting({ id, title, description, children }: { id: string; title: string; description: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid gap-4 py-8 md:grid-cols-[16rem_minmax(0,1fr)] md:gap-10">
      <div>
        <h2 id={id} className="text-base font-bold text-ink">
          {title}
        </h2>
        <div className="mt-1 text-[15px] text-ink-2">{description}</div>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export default async function AccountPage() {
  const user = await requireUser("/conta");
  const account = await getAccount(user.id);

  return (
    <Container className="max-w-4xl py-10 sm:py-14">
      <PageHeader title="Conta" />

      <div className="divide-y divide-line border-y border-line">
        <Setting id="perfil" title="Perfil" description="Seu nome aparece na lista de participantes.">
          <NameForm initialName={account.name} />
        </Setting>

        <Setting id="acesso" title="Acesso" description="Você entra com um código enviado para este e-mail. Ele não aparece para ninguém.">
          <dl className="space-y-2 text-[15px]">
            <div className="flex flex-wrap justify-between gap-x-4">
              <dt className="text-ink-2">E-mail</dt>
              <dd className="break-all text-ink">{account.email}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-x-4">
              <dt className="text-ink-2">Permissão</dt>
              <dd className="text-ink">{account.role === "ORGANIZER" ? "Organizador" : "Participante"}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-x-4">
              <dt className="text-ink-2">Conta criada em</dt>
              <dd className="text-ink">{formatDay(account.createdAt)}</dd>
            </div>
          </dl>
        </Setting>

        <Setting
          id="dados"
          title="Seus dados"
          description={
            <>
              Baixe uma cópia ou exclua tudo (LGPD).{" "}
              <Link href="/privacidade" className="text-ink underline underline-offset-4">
                Como tratamos seus dados
              </Link>
            </>
          }
        >
          <p className="mb-4 text-[15px] text-ink">
            Se você estiver num sorteio já realizado, a exclusão fica liberada quando o organizador excluir o sorteio — assim
            ninguém fica sem amigo secreto.
          </p>
          <DataActions />
        </Setting>
      </div>
    </Container>
  );
}
