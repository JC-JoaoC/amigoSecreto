import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ChangePasswordForm, DataActions, NameForm, ResendVerificationButton } from "@/components/account/account-forms";
import { AvatarForm } from "@/components/account/avatar-form";
import { ButtonLink } from "@/components/ui/button";
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
        <Setting id="perfil" title="Perfil" description="Sua foto e seu nome aparecem na lista de participantes.">
          <div className="space-y-8">
            <AvatarForm name={account.name} seed={account.id} avatarUrl={account.avatarUrl} />
            <NameForm initialName={account.name} />
          </div>
        </Setting>

        <Setting id="acesso" title="Acesso" description="Você entra com este e-mail e sua senha. O e-mail não aparece para ninguém.">
          <dl className="space-y-2 text-[15px]">
            <div className="flex flex-wrap justify-between gap-x-4">
              <dt className="text-ink-2">E-mail</dt>
              <dd className="text-ink [overflow-wrap:anywhere]">{account.email}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-x-4">
              <dt className="text-ink-2">Confirmação do e-mail</dt>
              <dd className={account.emailVerifiedAt ? "text-pine-700" : "text-ink"}>
                {account.emailVerifiedAt ? "Confirmado" : "Pendente"}
              </dd>
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
          {!account.emailVerifiedAt && (
            <div className="mt-4 rounded-panel bg-mist px-4 py-3">
              <p className="mb-3 text-[15px] text-ink">
                Confirme seu e-mail pelo link que enviamos no cadastro. Organizadores só recebem a permissão depois disso.
              </p>
              <ResendVerificationButton />
            </div>
          )}
        </Setting>

        <Setting id="senha" title="Senha" description="Ao trocar, as outras sessões abertas são encerradas.">
          {account.hasPassword ? (
            <ChangePasswordForm />
          ) : (
            <div className="space-y-3">
              <p className="text-[15px] text-ink">Sua conta ainda não tem senha. Crie uma pelo link enviado ao seu e-mail.</p>
              <ButtonLink href={`/esqueci-senha?email=${encodeURIComponent(account.email)}`} variant="outline">
                Criar minha senha
              </ButtonLink>
            </div>
          )}
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
            Se você estiver num sorteio já realizado, a exclusão fica liberada quando o organizador excluir o sorteio. Assim
            ninguém fica sem amigo secreto.
          </p>
          <DataActions />
        </Setting>
      </div>
    </Container>
  );
}
