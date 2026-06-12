import { jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { installFingerprintTag } from "./lib/install-salt";
import {
  JWT_AUDIENCE,
  JWT_ISSUER,
  sessionCookieNames,
} from "./lib/session-cookies";
import {
  clientRbacEnabled,
  isClientBlockedPath,
} from "./middleware/client-rbac";
import {
  clientMutationBlocked,
  csrfCheckFailed,
} from "./middleware/request-security";
import { applySecurityHeaders } from "./middleware/security-headers";
import { sessionSecretMinLength } from "./lib/security-config";

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
  "/api/newsletter/subscribe",
  "/api/newsletter/confirm",
  "/api/newsletter/unsubscribe",
  "/landing.css",
  "/landing.js",
  "/favicon.svg",
  "/logo.svg",
]);

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  if (pathname.startsWith("/api/branding")) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/assets/")) return true;
  return false;
}

function isApiV1Path(pathname: string): boolean {
  return pathname === "/api/v1" || pathname.startsWith("/api/v1/");
}

function getSecret(): Uint8Array | null {
  const secret = process.env.SESSION_SECRET;
  const min =
    process.env.NODE_ENV === "production" ? sessionSecretMinLength() : 16;
  if (!secret || secret.length < min) return null;
  return new TextEncoder().encode(secret);
}

function finish(request: NextRequest, response: NextResponse): NextResponse {
  const tag = installFingerprintTag();
  if (tag) response.headers.set("X-QB-Tag", tag);
  return applySecurityHeaders(request, response);
}

function clientForbiddenResponse(request: NextRequest, pathname: string) {
  if (pathname.startsWith("/api/")) {
    return finish(
      request,
      NextResponse.json(
        { error: "This action is only available to administrators." },
        { status: 403 },
      ),
    );
  }
  return finish(
    request,
    NextResponse.redirect(new URL("/dashboard", request.url)),
  );
}

function csrfForbidden(request: NextRequest) {
  return finish(
    request,
    NextResponse.json({ error: "Cross-site request blocked." }, { status: 403 }),
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (csrfCheckFailed(request)) {
    return csrfForbidden(request);
  }

  if (isPublicPath(pathname)) {
    return finish(request, NextResponse.next());
  }

  if (isApiV1Path(pathname)) {
    return finish(request, NextResponse.next());
  }

  let token: string | undefined;
  for (const name of sessionCookieNames()) {
    token = request.cookies.get(name)?.value;
    if (token) break;
  }
  const secret = getSecret();

  if (!token || !secret) {
    if (pathname.startsWith("/api/")) {
      return finish(
        request,
        NextResponse.json({ error: "Not logged in." }, { status: 401 }),
      );
    }
    return finish(
      request,
      NextResponse.redirect(new URL("/login", request.url)),
    );
  }

  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    const role = String(payload.role ?? "");
    if (role === "client" && clientRbacEnabled()) {
      if (isClientBlockedPath(pathname)) {
        return clientForbiddenResponse(request, pathname);
      }
      if (clientMutationBlocked(pathname, request.method)) {
        return clientForbiddenResponse(request, pathname);
      }
    }
    return finish(request, NextResponse.next());
  } catch {
    if (pathname.startsWith("/api/")) {
      return finish(
        request,
        NextResponse.json({ error: "Session expired." }, { status: 401 }),
      );
    }
    return finish(
      request,
      NextResponse.redirect(new URL("/login", request.url)),
    );
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
