import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ConfirmEmailButton } from "@/components/auth/password-recovery";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Confirmar e-mail" };

export default async function ConfirmEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token.slice(0, 200) : "";
  return (
    <AuthShell title="Confirmar e-mail" subtitle="Um clique para confirmar que este e-mail é seu.">
      {token ? (
        <ConfirmEmailButton token={token} />
      ) : (
        <div className="space-y-5">
          <p className="text-base text-ink">Este endereço está incompleto. Abra o link exatamente como chegou no e-mail.</p>
          <ButtonLink href="/conta">Ir para minha conta</ButtonLink>
        </div>
      )}
    </AuthShell>
  );
}
