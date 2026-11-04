import Link from "next/link";
import { Logo } from "@/components/logo";
import { avatarUrl } from "@/lib/avatar";
import { getCurrentUser } from "@/server/auth/current-user";
import { countUnreadMessages } from "@/server/services/messages";
import { HeaderNav } from "./header-nav";

export async function Header() {
  const user = await getCurrentUser();
  const unread = user ? await countUnreadMessages(user).catch(() => 0) : 0;
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-white/95 backdrop-blur-sm supports-[backdrop-filter]:bg-white/85">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-pine-900 focus:px-4 focus:py-2 focus:text-white"
      >
        Pular para o conteúdo
      </a>
      <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:px-8">
        <Link href="/" aria-label="Laço, página inicial" className="shrink-0 rounded-md">
          <Logo />
        </Link>
        <HeaderNav user={user ? { id: user.id, name: user.name, avatarUrl: avatarUrl(user.id, user.avatarUpdatedAt) } : null} unread={unread} />
      </div>
    </header>
  );
}
