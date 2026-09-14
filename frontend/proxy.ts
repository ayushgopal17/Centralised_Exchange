import { NextRequest, NextResponse } from "next/server";

const PUBLIC = new Set(["/login", "/register"]);

export function proxy(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get("cex_session")?.value);
  const { pathname } = request.nextUrl;
  if (!hasSession && !PUBLIC.has(pathname)) return NextResponse.redirect(new URL("/login", request.url));
  if (hasSession && PUBLIC.has(pathname)) return NextResponse.redirect(new URL("/", request.url));
  return NextResponse.next();
}

export const config = { matcher: ["/", "/markets/:path*", "/wallet/:path*", "/settings/:path*"] };
