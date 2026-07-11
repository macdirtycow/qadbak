/** Edge-safe session cookie names (no Node fs / rate-limit imports). */
import { installSalt } from "./install-salt";

export const JWT_ISSUER = "qadbak";
export const JWT_AUDIENCE = "qadbak-panel";

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

/** Edge-safe Bearer extraction for middleware and route handlers. */
export function bearerTokenFromAuthorizationHeader(
  authorization: string | null | undefined,
): string | null {
  if (!authorization) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(authorization.trim());
  return match?.[1] ?? null;
}
