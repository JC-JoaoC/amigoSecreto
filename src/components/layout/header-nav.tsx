"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { firstName } from "@/lib/text";

type NavUser = { id: string; name: string } | null;

const privateLinks = [
  { href: "/meus-presentes", label: "Meus presentes" },
  { href: "/sorteios", label: "Sorteios" },
  { href: "/meu-resultado", label: "Meu amigo secreto" },
  { href: "/conta", label: "Conta" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function UnreadCount({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="tabular ml-1.5 inline-grid h-5 min-w-5 place-items-center rounded-full bg-berry-600 px-1.5 text-xs font-medium text-white">
      {count}
      <span className="sr-only"> {count === 1 ? "mensagem nova" : "mensagens novas"}</span>
    </span>
  );
}

export function HeaderNav({ user, unread = 0 }: { user: NavUser; unread?: number }) {
  const pathname = usePathname();
  // O menu "pertence" à rota em que foi aberto: ao navegar, fecha sozinho.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenOn(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const links = [{ href: "/", label: "Participantes" }, ...(user ? privateLinks : [])];

  return (
    <>
      <nav aria-label="Principal" className="hidden flex-1 items-center gap-1 lg:flex">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={isActive(pathname, l.href) ? "page" : undefined}
            className={cn(
              "inline-flex h-9 items-center rounded-[var(--radius-control)] px-3 text-[15px] transition-colors",
              isActive(pathname, l.href) ? "bg-mist-2 font-medium text-ink" : "text-ink-2 hover:bg-mist hover:text-ink",
            )}
          >
            {l.label}
            {l.href === "/meu-resultado" && <UnreadCount count={unread} />}
          </Link>
        ))}
      </nav>

      <div className="hidden items-center gap-2 lg:flex">
        {user ? (
          <>
            <span className="flex items-center gap-2 text-[15px] text-ink">
              <Avatar name={user.name} seed={user.id} size="sm" />
              {firstName(user.name)}
            </span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-control)] px-3 text-[15px] text-ink-2 transition-colors hover:bg-mist hover:text-ink"
              >
                <LogOut className="size-4" aria-hidden /> Sair
              </button>
            </form>
          </>
        ) : (
          <>
            <ButtonLink href="/entrar" variant="ghost" size="sm">
              Entrar
            </ButtonLink>
            <ButtonLink href="/cadastro" size="sm">
              Criar conta
            </ButtonLink>
          </>
        )}
      </div>

      {/* Celular */}
      <div className="flex items-center gap-2 lg:hidden">
        {!user && (
          <ButtonLink href="/entrar" size="sm" variant="outline">
            Entrar
          </ButtonLink>
        )}
        <button
          type="button"
          onClick={() => setOpenOn(open ? null : pathname)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          className="relative grid size-10 place-items-center rounded-[var(--radius-control)] border border-line-strong bg-white text-ink"
        >
          {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          {!open && unread > 0 && <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-berry-600" aria-hidden />}
        </button>
      </div>

      {open && (
        <div id="mobile-menu" className="absolute inset-x-0 top-full z-40 animate-rise border-b border-line bg-white shadow-[var(--shadow-float)] lg:hidden">
          <nav aria-label="Menu" className="mx-auto max-w-6xl px-4 py-3 sm:px-8">
            {user && (
              <p className="flex items-center gap-3 px-3 pb-3 pt-1 text-[15px] text-ink">
                <Avatar name={user.name} seed={user.id} size="sm" />
                {user.name}
              </p>
            )}
            <ul className="space-y-0.5">
              {links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={isActive(pathname, l.href) ? "page" : undefined}
                    className={cn(
                      "flex min-h-12 items-center rounded-[var(--radius-control)] px-3 text-base",
                      isActive(pathname, l.href) ? "bg-mist-2 font-medium text-ink" : "text-ink hover:bg-mist",
                    )}
                  >
                    {l.label}
                    {l.href === "/meu-resultado" && <UnreadCount count={unread} />}
                  </Link>
                </li>
              ))}
              <li className="mt-2 border-t border-line pt-2">
                {user ? (
                  <form action={logoutAction}>
                    <button type="submit" className="flex min-h-12 w-full items-center gap-2 rounded-[var(--radius-control)] px-3 text-base text-ink-2 hover:bg-mist">
                      <LogOut className="size-4" aria-hidden /> Sair
                    </button>
                  </form>
                ) : (
                  <Link href="/cadastro" className="flex min-h-12 items-center rounded-[var(--radius-control)] px-3 text-base font-medium text-ink hover:bg-mist">
                    Criar conta
                  </Link>
                )}
              </li>
            </ul>
          </nav>
        </div>
      )}
    </>
  );
}
