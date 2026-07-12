import { clearAllSessionCookies, sessionCookieNames } from "@/lib/session";
import { markUserLoggedOut, revokeSessionJti } from "@/lib/session-revocation";
import {
  JWT_AUDIENCE,
  JWT_ISSUER,
  bearerTokenFromAuthorizationHeader,
} from "@/lib/session-cookies";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

function sessionSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET missing.");
  }
  return new TextEncoder().encode(secret);
}

async function tokenFromRequest(request: Request): Promise<string | undefined> {
  const jar = await cookies();
  for (const name of sessionCookieNames()) {
    const value = jar.get(name)?.value;
    if (value) return value;
  }
  return bearerTokenFromAuthorizationHeader(request.headers.get("authorization")) ?? undefined;
}

/** Public - must clear cookies even when the JWT is expired. */
export async function POST(request: Request) {
  const token = await tokenFromRequest(request);
  if (token) {
    try {
      const { payload } = await jwtVerify(token, sessionSecret(), {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      });
      const userId = String(payload.userId || "");
      if (userId) await markUserLoggedOut(userId);
      if (payload.jti && typeof payload.exp === "number") {
        await revokeSessionJti(String(payload.jti), payload.exp);
      }
    } catch {
      /* expired or invalid — still clear cookies */
    }
  }
  const response = NextResponse.json({ ok: true });
  return clearAllSessionCookies(response, request);
}
