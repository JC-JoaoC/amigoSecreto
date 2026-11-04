import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/password-recovery";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Criar nova senha" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token.slice(0, 200) : "";
  return (
    <AuthShell title="Criar nova senha" subtitle="Escolha a senha que você vai usar para entrar.">
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div className="space-y-5">
          <p className="text-base text-ink">Este endereço está incompleto. Abra o link exatamente como chegou no e-mail.</p>
          <ButtonLink href="/esqueci-senha">Pedir um novo link</ButtonLink>
        </div>
      )}
    </AuthShell>
  );
}
