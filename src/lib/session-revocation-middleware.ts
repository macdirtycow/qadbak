import type { NextRequest } from "next/server";
import {
  INTERNAL_SESSION_REVOCATION_HEADER,
  internalSessionRevocationToken,
} from "./internal-api-auth";
import { sessionRevokedSync } from "./session-revocation-sync";

/** Check revocation in Node middleware (sync file read). */
export function sessionRevokedInMiddleware(
  jti: string | undefined,
  userId: string,
  iat: number,
): boolean {
  return sessionRevokedSync(jti, userId, iat);
}

/** Edge-safe fallback when sync store is unavailable. */
export async function sessionRevokedViaInternalApi(
  request: NextRequest,
  jti: string | undefined,
  userId: string,
  iat: number,
): Promise<boolean | null> {
  const token = internalSessionRevocationToken();
  if (!token) return null;
  try {
    const url = new URL("/api/internal/session-revocation", request.url);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [INTERNAL_SESSION_REVOCATION_HEADER]: token,
      },
      body: JSON.stringify({ jti, userId, iat }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { revoked?: boolean };
    return Boolean(body.revoked);
  } catch {
    return null;
  }
}

export async function isSessionRevokedAtEdge(
  request: NextRequest,
  jti: string | undefined,
  userId: string,
  iat: number,
): Promise<boolean> {
  if (sessionRevokedInMiddleware(jti, userId, iat)) {
    return true;
  }
  const viaApi = await sessionRevokedViaInternalApi(request, jti, userId, iat);
  return viaApi === true;
}
