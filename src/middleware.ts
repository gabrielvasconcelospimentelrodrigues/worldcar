import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE = "wc_session";

// O middleware roda no edge: nada de Prisma/bcrypt aqui, so verificacao do JWT.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(COOKIE)?.value;

  let valido = false;
  if (token && process.env.AUTH_SECRET) {
    try {
      await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET));
      valido = true;
    } catch {
      valido = false;
    }
  }

  if (pathname.startsWith("/sistema") && !valido) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("de", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname === "/login" && valido) {
    const url = req.nextUrl.clone();
    url.pathname = "/sistema";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/sistema/:path*", "/login"],
};
