import fs from "fs/promises";
import path from "path";
import { assertPathWithinRoot } from "./safe-path";

const BUCKET_DIR = path.join(process.cwd(), "data", "rate-buckets");
const LEGACY_FILE = path.join(process.cwd(), "data", "api-rate-buckets.json");

interface BucketRow {
  count: number;
  resetAt: number;
}

function safeKey(bucketKey: string): string {
  return bucketKey.replace(/[^a-zA-Z0-9:_-]/g, "_").slice(0, 120);
}

function bucketFile(bucketKey: string): string {
  const file = path.join(BUCKET_DIR, `${safeKey(bucketKey)}.json`);
  return assertPathWithinRoot(BUCKET_DIR, file);
}

async function readBucket(bucketKey: string): Promise<BucketRow | null> {
  try {
    const raw = await fs.readFile(bucketFile(bucketKey), "utf8");
    const row = JSON.parse(raw) as BucketRow;
    if (typeof row.count === "number" && typeof row.resetAt === "number") {
      return row;
    }
  } catch {
    /* missing */
  }
  return null;
}

async function writeBucket(bucketKey: string, row: BucketRow): Promise<void> {
  await fs.mkdir(BUCKET_DIR, { recursive: true });
  await fs.writeFile(bucketFile(bucketKey), `${JSON.stringify(row)}\n`, "utf8");
}

/** One-time import from legacy single-file store. */
async function migrateLegacyIfNeeded(): Promise<void> {
  try {
    const raw = await fs.readFile(LEGACY_FILE, "utf8");
    const data = JSON.parse(raw) as { buckets?: Record<string, BucketRow> };
    for (const [key, row] of Object.entries(data.buckets ?? {})) {
      if (row && typeof row.count === "number") {
        await writeBucket(key, row);
      }
    }
    await fs.rename(LEGACY_FILE, `${LEGACY_FILE}.migrated`);
  } catch {
    /* no legacy file */
  }
}

let migrated = false;
async function ensureMigrated(): Promise<void> {
  if (migrated) return;
  migrated = true;
  await migrateLegacyIfNeeded();
}

async function mutateBucket(
  bucketKey: string,
  limit: number,
  windowMs: number,
  mode: "peek" | "bump",
): Promise<{ ok: boolean; retryAfterSec?: number }> {
  await ensureMigrated();
  const now = Date.now();
  const row = (await readBucket(bucketKey)) ?? {
    count: 0,
    resetAt: now + windowMs,
  };
  if (now >= row.resetAt) {
    row.count = 0;
    row.resetAt = now + windowMs;
  }
  if (row.count >= limit) {
    return {
      ok: false,
      retryAfterSec: Math.ceil((row.resetAt - now) / 1000),
    };
  }
  if (mode === "peek") {
    return { ok: true };
  }
  row.count += 1;
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      await writeBucket(bucketKey, row);
      return { ok: true };
    } catch {
      await new Promise((r) => setTimeout(r, 10 * (attempt + 1)));
    }
  }
  return { ok: true };
}

/** Check limit without consuming a slot (login pre-check). */
export async function peekRateLimit(
  bucketKey: string,
  limit: number,
  windowMs: number,
): Promise<{ ok: boolean; retryAfterSec?: number }> {
  return mutateBucket(bucketKey, limit, windowMs, "peek");
}

/** Record one failed attempt (login brute-force). */
export async function recordRateLimitFailure(
  bucketKey: string,
  limit: number,
  windowMs: number,
): Promise<void> {
  await mutateBucket(bucketKey, limit, windowMs, "bump");
}

/** Fixed-window rate limit — each allowed request consumes one slot. */
export async function checkRateLimit(
  bucketKey: string,
  limit: number,
  windowMs: number,
): Promise<{ ok: boolean; retryAfterSec?: number }> {
  return mutateBucket(bucketKey, limit, windowMs, "bump");
}

/** Per API key id — default 120 req/min. */
export async function checkApiRateLimit(
  keyId: string,
  limit = 120,
  windowMs = 60_000,
): Promise<{ ok: boolean; retryAfterSec?: number }> {
  return checkRateLimit(`api:${keyId}`, limit, windowMs);
}

const LOGIN_LIMIT = Number(process.env.QADBAK_LOGIN_RATE_LIMIT ?? "8") || 8;
const LOGIN_WINDOW_MS = 15 * 60_000;
const LOGIN_IP_LIMIT = Number(process.env.QADBAK_LOGIN_RATE_LIMIT_PER_IP ?? "40") || 40;

/** Brute-force guard for panel sign-in (peek only — bump on failed password/TOTP). */
export async function checkLoginRateLimit(
  clientIp: string,
  username: string,
): Promise<{ ok: boolean; retryAfterSec?: number }> {
  const user = username.trim().toLowerCase() || "unknown";
  const ip = clientIp.trim() || "unknown";
  const byIp = await peekRateLimit(`login-ip:${ip}`, LOGIN_IP_LIMIT, LOGIN_WINDOW_MS);
  if (!byIp.ok) return byIp;
  return peekRateLimit(`login:${ip}:${user}`, LOGIN_LIMIT, LOGIN_WINDOW_MS);
}

export async function recordLoginRateLimitFailure(
  clientIp: string,
  username: string,
): Promise<void> {
  const user = username.trim().toLowerCase() || "unknown";
  const ip = clientIp.trim() || "unknown";
  await recordRateLimitFailure(`login-ip:${ip}`, LOGIN_IP_LIMIT, LOGIN_WINDOW_MS);
  await recordRateLimitFailure(`login:${ip}:${user}`, LOGIN_LIMIT, LOGIN_WINDOW_MS);
}
