import { type NextRequest, NextResponse } from "next/server";

/**
 * Checagem OTIMISTA: sem cookie de sessão, nem tenta abrir página privada — vai direto ao login.
 * A validação real (sessão no banco, expiração, permissões) acontece no servidor em cada página/ação.
 */
const SESSION_COOKIE = "laco_session";
const PRIVATE_PREFIXES = ["/meus-presentes", "/sorteios", "/meu-resultado", "/conta"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isPrivate = PRIVATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (isPrivate && !request.cookies.get(SESSION_COOKIE)?.value) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/meus-presentes/:path*", "/sorteios/:path*", "/meu-resultado/:path*", "/conta/:path*"],
};
