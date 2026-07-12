import { mkdir, readFile, writeFile, chmod } from "node:fs/promises";
import path from "node:path";

function revocationsPath(): string {
  return (
    process.env.QADBAK_SESSION_REVOCATIONS_PATH?.trim() ||
    path.join(process.cwd(), "data", "session-revocations.json")
  );
}

type RevocationStore = Record<string, number>;

async function loadStore(): Promise<RevocationStore> {
  const REVOCATIONS_PATH = revocationsPath();
  try {
    const raw = await readFile(REVOCATIONS_PATH, "utf8");
    const parsed = JSON.parse(raw) as RevocationStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function saveStore(store: RevocationStore): Promise<void> {
  const REVOCATIONS_PATH = revocationsPath();
  await mkdir(path.dirname(REVOCATIONS_PATH), { recursive: true });
  const now = Math.floor(Date.now() / 1000);
  const pruned: RevocationStore = {};
  for (const [key, value] of Object.entries(store)) {
    if (typeof value !== "number") continue;
    if (key.startsWith("user:")) {
      // Keep logout markers long enough for max session lifetime (30 days).
      if (value + 30 * 24 * 3600 > now) pruned[key] = value;
    } else if (value > now) {
      pruned[key] = value;
    }
  }
  await writeFile(REVOCATIONS_PATH, JSON.stringify(pruned), "utf8");
  await chmod(REVOCATIONS_PATH, 0o600).catch(() => undefined);
  try {
    const { bumpRevocationCache } = await import("./session-revocation-sync");
    bumpRevocationCache();
  } catch {
    /* sync module unavailable in edge builds */
  }
}

export async function revokeSessionJti(
  jti: string,
  expiresAtSec: number,
): Promise<void> {
  const id = jti.trim();
  if (!id) return;
  const store = await loadStore();
  store[id] = expiresAtSec;
  await saveStore(store);
}

export async function isSessionRevoked(jti: string | undefined): Promise<boolean> {
  if (!jti) return false;
  const store = await loadStore();
  const exp = store[jti];
  if (!exp) return false;
  if (Math.floor(Date.now() / 1000) > exp) {
    delete store[jti];
    await saveStore(store);
    return false;
  }
  return true;
}

/** Record logout time — sessions issued at or before this second are invalid. */
export async function markUserLoggedOut(userId: string): Promise<void> {
  const store = await loadStore();
  store[`user:${userId}`] = Math.floor(Date.now() / 1000);
  await saveStore(store);
}

export async function isUserSessionRevoked(
  userId: string,
  issuedAtSec: number,
): Promise<boolean> {
  const store = await loadStore();
  const logoutAt = store[`user:${userId}`];
  if (!logoutAt) return false;
  return issuedAtSec <= logoutAt;
}
