import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/password-recovery";

export const metadata: Metadata = { title: "Esqueci minha senha" };

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const sp = await searchParams;
  return (
    <AuthShell title="Esqueci minha senha" subtitle="Digite o e-mail da sua conta. Enviamos um link para você criar uma nova senha.">
      <ForgotPasswordForm initialEmail={typeof sp.email === "string" ? sp.email.slice(0, 254) : ""} />
    </AuthShell>
  );
}
