import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";
import { safeNextPath } from "@/lib/action-result";
import { getCurrentUser } from "@/server/auth/current-user";

export const metadata: Metadata = { title: "Criar conta" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ email?: string; next?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? safeNextPath(sp.next, "") || undefined : undefined;

  return (
    <AuthShell title="Criar conta" subtitle="Leva menos de um minuto. Depois é só montar sua lista de desejos.">
      <RegisterForm initialEmail={typeof sp.email === "string" ? sp.email.slice(0, 254) : ""} next={next} />
    </AuthShell>
  );
}
