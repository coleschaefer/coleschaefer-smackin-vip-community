import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const expected = process.env.OPS_ACCESS_TOKEN;
  if (!expected) return NextResponse.next();
  if (request.nextUrl.pathname === "/login") return NextResponse.next();
  const given = request.cookies.get("ops_token")?.value ?? "";
  if (given.length === expected.length && given === expected) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
