import { randomBytes } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const DATA_PATH = path.join(process.cwd(), "data", "mobile-push-tokens.json");

export type MobilePushToken = {
  id: string;
  userId: string;
  token: string;
  platform: "ios";
  bundleId?: string;
  deviceLabel?: string;
  createdAt: string;
  updatedAt: string;
};

type PushStore = {
  tokens: MobilePushToken[];
};

let cache: PushStore | null = null;
let mtimeMs = 0;

async function loadStore(): Promise<PushStore> {
  try {
    const { mtimeMs: m } = await stat(DATA_PATH);
    if (cache && m === mtimeMs) return cache;
    const raw = await readFile(DATA_PATH, "utf8");
    cache = JSON.parse(raw) as PushStore;
    mtimeMs = m;
    return cache;
  } catch {
    cache = { tokens: [] };
    mtimeMs = 0;
    return cache;
  }
}

async function saveStore(store: PushStore): Promise<void> {
  await mkdir(path.dirname(DATA_PATH), { recursive: true });
  await writeFile(DATA_PATH, JSON.stringify(store, null, 2), "utf8");
  cache = store;
  try {
    mtimeMs = (await stat(DATA_PATH)).mtimeMs;
  } catch {
    mtimeMs = 0;
  }
}

function normalizeToken(token: string): string {
  return token.replace(/\s+/g, "").toLowerCase();
}

export async function registerMobilePushToken(input: {
  userId: string;
  token: string;
  bundleId?: string;
  deviceLabel?: string;
}): Promise<MobilePushToken> {
  const token = normalizeToken(input.token);
  if (!/^[a-f0-9]{32,}$/.test(token)) {
    throw new Error("Invalid device token.");
  }
  const now = new Date().toISOString();
  const store = await loadStore();
  const existing = store.tokens.find(
    (t) => t.userId === input.userId && t.token === token,
  );
  if (existing) {
    existing.updatedAt = now;
    existing.bundleId = input.bundleId?.trim() || existing.bundleId;
    existing.deviceLabel = input.deviceLabel?.trim() || existing.deviceLabel;
    await saveStore(store);
    return existing;
  }
  const record: MobilePushToken = {
    id: randomBytes(12).toString("hex"),
    userId: input.userId,
    token,
    platform: "ios",
    bundleId: input.bundleId?.trim() || undefined,
    deviceLabel: input.deviceLabel?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };
  store.tokens.push(record);
  await saveStore(store);
  return record;
}

export async function unregisterMobilePushToken(
  userId: string,
  token: string,
): Promise<void> {
  const normalized = normalizeToken(token);
  const store = await loadStore();
  const next = store.tokens.filter(
    (t) => !(t.userId === userId && t.token === normalized),
  );
  if (next.length !== store.tokens.length) {
    await saveStore({ tokens: next });
  }
}

export async function unregisterAllMobilePushTokens(userId: string): Promise<void> {
  const store = await loadStore();
  const next = store.tokens.filter((t) => t.userId !== userId);
  if (next.length !== store.tokens.length) {
    await saveStore({ tokens: next });
  }
}

export async function listMobilePushTokensForUser(
  userId: string,
): Promise<MobilePushToken[]> {
  const store = await loadStore();
  return store.tokens.filter((t) => t.userId === userId);
}
