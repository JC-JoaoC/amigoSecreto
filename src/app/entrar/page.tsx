import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { safeNextPath } from "@/lib/action-result";
import { getCurrentUser } from "@/server/auth/current-user";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; email?: string }> }) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? safeNextPath(sp.next, "") || undefined : undefined;
  if (await getCurrentUser()) redirect(next ?? "/");

  return (
    <AuthShell title="Entrar" subtitle="Digite seu e-mail e enviaremos um código para você entrar.">
      <LoginForm next={next} initialEmail={typeof sp.email === "string" ? sp.email.slice(0, 254) : ""} />
    </AuthShell>
  );
}
