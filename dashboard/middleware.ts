import { NextRequest, NextResponse } from "next/server";

/**
 * Minimal password gate. If DEMO_ACCESS_CODE is set, the dashboard requires
 * `?code=<value>` on first load and sets a cookie for subsequent navigation.
 * If DEMO_ACCESS_CODE is unset, the middleware is a no-op (open access — OK
 * for local dev and pure-demo deployments).
 */
export function middleware(req: NextRequest) {
  const code = process.env.DEMO_ACCESS_CODE;
  if (!code) return NextResponse.next();

  const cookie = req.cookies.get("ssot-auth");
  if (cookie?.value === code) return NextResponse.next();

  const urlCode = req.nextUrl.searchParams.get("code");
  if (urlCode === code) {
    const res = NextResponse.next();
    res.cookies.set({
      name: "ssot-auth",
      value: code,
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
    return res;
  }

  return new NextResponse("Access code required", {
    status: 401,
    headers: { "Content-Type": "text/plain" },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
