import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function revocationsPath(): string {
  return (
    process.env.QADBAK_SESSION_REVOCATIONS_PATH?.trim() ||
    path.join(process.cwd(), "data", "session-revocations.json")
  );
}

type RevocationStore = Record<string, number>;

let cachedStore: RevocationStore | null = null;
let cachedAtMs = 0;
let cachedPath = "";
const CACHE_TTL_MS = 1000;

function loadStoreSync(): RevocationStore {
  const REVOCATIONS_PATH = revocationsPath();
  const now = Date.now();
  if (
    cachedStore &&
    cachedPath === REVOCATIONS_PATH &&
    now - cachedAtMs < CACHE_TTL_MS
  ) {
    return cachedStore;
  }
  try {
    if (!existsSync(REVOCATIONS_PATH)) {
      cachedStore = {};
      cachedAtMs = now;
      cachedPath = REVOCATIONS_PATH;
      return cachedStore;
    }
    const raw = readFileSync(REVOCATIONS_PATH, "utf8");
    const parsed = JSON.parse(raw) as RevocationStore;
    cachedStore = parsed && typeof parsed === "object" ? parsed : {};
    cachedAtMs = now;
    cachedPath = REVOCATIONS_PATH;
    return cachedStore;
  } catch {
    cachedStore = {};
    cachedAtMs = now;
    cachedPath = REVOCATIONS_PATH;
    return cachedStore;
  }
}

/** Sync revocation check for middleware (Node runtime, 1s cache). */
export function isSessionRevokedSync(jti: string | undefined): boolean {
  if (!jti) return false;
  const store = loadStoreSync();
  const exp = store[jti];
  if (!exp) return false;
  if (Math.floor(Date.now() / 1000) > exp) return false;
  return true;
}

export function isUserSessionRevokedSync(
  userId: string,
  issuedAtSec: number,
): boolean {
  const store = loadStoreSync();
  const logoutAt = store[`user:${userId}`];
  if (!logoutAt) return false;
  return issuedAtSec <= logoutAt;
}

export function sessionRevokedSync(
  jti: string | undefined,
  userId: string,
  issuedAtSec: number,
): boolean {
  return (
    isSessionRevokedSync(jti) ||
    isUserSessionRevokedSync(userId, issuedAtSec)
  );
}

/** Invalidate middleware cache after logout/revoke (Node handlers). */
export function bumpRevocationCache(): void {
  cachedStore = null;
  cachedAtMs = 0;
  cachedPath = "";
}
