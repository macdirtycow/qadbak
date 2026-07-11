import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SessionPayload } from "./types";
import { createMobileAccessToken } from "./session";
import {
  MOBILE_ACCESS_TTL_SEC,
  MOBILE_REFRESH_TTL_SEC,
} from "./mobile-auth-constants";

const DATA_PATH = path.join(process.cwd(), "data", "mobile-refresh-tokens.json");

const REFRESH_PREFIX = "qmr_";

type RefreshRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  deviceLabel?: string;
};

type RefreshStore = {
  tokens: RefreshRecord[];
};

let storeCache: RefreshStore | null = null;
let storeMtimeMs = 0;

function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function newRefreshToken(): string {
  return `${REFRESH_PREFIX}${randomBytes(32).toString("base64url")}`;
}

async function loadStore(): Promise<RefreshStore> {
  try {
    const { mtimeMs } = await stat(DATA_PATH);
    if (storeCache && mtimeMs === storeMtimeMs) return storeCache;
    const raw = await readFile(DATA_PATH, "utf8");
    storeCache = JSON.parse(raw) as RefreshStore;
    storeMtimeMs = mtimeMs;
    return storeCache;
  } catch {
    storeCache = { tokens: [] };
    storeMtimeMs = 0;
    return storeCache;
  }
}

async function saveStore(store: RefreshStore): Promise<void> {
  await mkdir(path.dirname(DATA_PATH), { recursive: true });
  await writeFile(DATA_PATH, JSON.stringify(store, null, 2), "utf8");
  storeCache = store;
  try {
    storeMtimeMs = (await stat(DATA_PATH)).mtimeMs;
  } catch {
    storeMtimeMs = 0;
  }
}

function pruneExpired(store: RefreshStore): RefreshStore {
  const now = Date.now();
  return {
    tokens: store.tokens.filter((t) => Date.parse(t.expiresAt) > now),
  };
}

export type MobileTokenPair = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: "Bearer";
};

export async function issueMobileTokens(
  payload: SessionPayload,
  deviceLabel?: string,
): Promise<MobileTokenPair> {
  const accessToken = await createMobileAccessToken(payload);
  const refreshToken = newRefreshToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + MOBILE_REFRESH_TTL_SEC * 1000);

  const store = pruneExpired(await loadStore());
  store.tokens.push({
    id: randomBytes(12).toString("hex"),
    userId: payload.userId,
    tokenHash: hashRefreshToken(refreshToken),
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    deviceLabel: deviceLabel?.trim() || undefined,
  });
  await saveStore(store);

  return {
    accessToken,
    refreshToken,
    expiresIn: MOBILE_ACCESS_TTL_SEC,
    tokenType: "Bearer",
  };
}

export async function rotateMobileRefreshToken(
  refreshToken: string,
  payload: SessionPayload,
  deviceLabel?: string,
): Promise<MobileTokenPair> {
  if (!refreshToken.startsWith(REFRESH_PREFIX)) {
    throw new Error("Invalid refresh token.");
  }
  const tokenHash = hashRefreshToken(refreshToken);
  const store = pruneExpired(await loadStore());
  const idx = store.tokens.findIndex(
    (t) => t.tokenHash === tokenHash && t.userId === payload.userId,
  );
  if (idx < 0) {
    throw new Error("Refresh token expired or revoked.");
  }
  store.tokens.splice(idx, 1);
  await saveStore(store);
  return issueMobileTokens(payload, deviceLabel);
}

export async function findUserIdForRefreshToken(
  refreshToken: string,
): Promise<string | null> {
  if (!refreshToken.startsWith(REFRESH_PREFIX)) return null;
  const tokenHash = hashRefreshToken(refreshToken);
  const store = pruneExpired(await loadStore());
  const found = store.tokens.find((t) => t.tokenHash === tokenHash);
  return found?.userId ?? null;
}

export async function revokeMobileRefreshToken(refreshToken: string): Promise<void> {
  if (!refreshToken.startsWith(REFRESH_PREFIX)) return;
  const tokenHash = hashRefreshToken(refreshToken);
  const store = pruneExpired(await loadStore());
  const next = store.tokens.filter((t) => t.tokenHash !== tokenHash);
  if (next.length !== store.tokens.length) {
    await saveStore({ tokens: next });
  }
}

export async function revokeAllMobileRefreshTokens(userId: string): Promise<void> {
  const store = pruneExpired(await loadStore());
  const next = store.tokens.filter((t) => t.userId !== userId);
  if (next.length !== store.tokens.length) {
    await saveStore({ tokens: next });
  }
}
