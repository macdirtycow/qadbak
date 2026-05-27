import { jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { installFingerprintTag } from "./lib/install-salt";
import { sessionCookieNames } from "./lib/session";
import {
  clientRbacEnabled,
  isClientBlockedPath,
} from "./middleware/client-rbac";

const PUBLIC_EXACT = new Set([
  "/",
  "/login",
  "/about",
  "/privacy",
  "/refund",
  "/terms",
  "/api/auth/login",
  "/api/health",
  "/api/branding",
  "/landing.css",
  "/landing.js",
  "/favicon.svg",
  "/logo.svg",
]);

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  if (pathname.startsWith("/api/branding")) return true;
  if (pathname.startsWith("/_next")) return true;
  return false;
}

function getSecret(): Uint8Array | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) return null;
  return new TextEncoder().encode(secret);
}

function clientForbiddenResponse(request: NextRequest, pathname: string) {
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "This action is only available to administrators." },
      { status: 403 },
    );
  }
  return NextResponse.redirect(new URL("/dashboard", request.url));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    const res = NextResponse.next();
    const tag = installFingerprintTag();
    if (tag) res.headers.set("X-QB-Tag", tag);
    return res;
  }

  let token: string | undefined;
  for (const name of sessionCookieNames()) {
    token = request.cookies.get(name)?.value;
    if (token) break;
  }
  const secret = getSecret();

  if (!token || !secret) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Not logged in." }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const { payload } = await jwtVerify(token, secret);
    const role = String(payload.role ?? "");
    if (
      role === "client" &&
      clientRbacEnabled() &&
      isClientBlockedPath(pathname)
    ) {
      return clientForbiddenResponse(request, pathname);
    }
    const res = NextResponse.next();
    const tag = installFingerprintTag();
    if (tag) res.headers.set("X-QB-Tag", tag);
    return res;
  } catch {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Session expired." }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
