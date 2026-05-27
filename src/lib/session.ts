import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import type { SessionPayload } from "./types";

import { installSalt } from "./install-salt";

const LEGACY_COOKIE = "panel_session";

export function sessionCookieName(): string {
  const salt = installSalt();
  return salt ? `qb-${salt}-session` : LEGACY_COOKIE;
}

/** Cookie names accepted during session read (salted + legacy). */
export function sessionCookieNames(): string[] {
  const primary = sessionCookieName();
  return primary === LEGACY_COOKIE
    ? [LEGACY_COOKIE]
    : [primary, LEGACY_COOKIE];
}

/**
 * Cookie Secure flag is set per-request to match the actual response
 * protocol. This makes first-time installs over plain HTTP (e.g. the
 * bootstrap panel on http://<ip>:11000/login before the operator
 * configures HTTPS) work out of the box — browsers silently drop
 * Set-Cookie with Secure when the response was over HTTP, which would
 * otherwise prevent login.
 *
 * The QADBAK_COOKIE_SECURE env var still acts as an explicit override
 * (set "true" or "false") for operators who want to lock the behaviour.
 */
function isHttpsRequest(request?: Request | NextRequest): boolean {
  if (!request) return false;
  const xfp = request.headers.get("x-forwarded-proto");
  if (xfp) return xfp.toLowerCase().split(",")[0].trim() === "https";
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return false;
  }
}

function sessionCookieSecure(request?: Request | NextRequest): boolean {
  if (process.env.QADBAK_COOKIE_SECURE === "false") return false;
  // Never mark cookies Secure on plain HTTP (e.g. bootstrap panel :11000) even when
  // .env.local has QADBAK_COOKIE_SECURE=true after certbot on the HTTPS vhost.
  if (request && !isHttpsRequest(request)) return false;
  if (process.env.QADBAK_COOKIE_SECURE === "true") return true;
  if (request) return isHttpsRequest(request);
  return process.env.NODE_ENV === "production";
}

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET is missing or too short (min. 16 characters).");
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey());
}

export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return {
      userId: String(payload.userId),
      username: String(payload.username),
      role: payload.role as SessionPayload["role"],
      domains: (payload.domains as string[]) ?? [],
    };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  let token: string | undefined;
  for (const name of sessionCookieNames()) {
    token = jar.get(name)?.value;
    if (token) break;
  }
  if (!token) return null;
  return verifySessionToken(token);
}

export function sessionCookieOptions(
  token: string,
  request?: Request | NextRequest,
) {
  return {
    name: sessionCookieName(),
    value: token,
    httpOnly: true,
    secure: sessionCookieSecure(request),
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };
}

/** Attach session to a Route Handler response (required for browser login). */
export function applySessionCookie(
  response: NextResponse,
  token: string,
  request?: Request | NextRequest,
) {
  const opts = sessionCookieOptions(token, request);
  response.cookies.set(opts.name, opts.value, {
    httpOnly: opts.httpOnly,
    secure: opts.secure,
    sameSite: opts.sameSite,
    path: opts.path,
    maxAge: opts.maxAge,
  });
  return response;
}

export function clearSessionCookieOptions(request?: Request | NextRequest) {
  return {
    name: sessionCookieName(),
    value: "",
    httpOnly: true,
    secure: sessionCookieSecure(request),
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}
