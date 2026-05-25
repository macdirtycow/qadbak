import { jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  clientRbacEnabled,
  isClientBlockedPath,
} from "./middleware/client-rbac";

const COOKIE_NAME = "panel_session";

const PUBLIC_EXACT = new Set([
  "/",
  "/login",
  "/about",
  "/privacy",
  "/refund",
  "/terms",
  "/api/auth/login",
  "/api/health",
  "/landing.css",
  "/landing.js",
  "/favicon.svg",
]);

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
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
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
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
    return NextResponse.next();
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
