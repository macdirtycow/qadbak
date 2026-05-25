import "server-only";
import { createHash, createPublicKey, randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { KeyObject } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";

const DATA_DIR = path.join(process.cwd(), "data");
const LICENSE_PATH = path.join(DATA_DIR, "license.json");
const INSTANCE_PATH = path.join(DATA_DIR, "instance-id");

export type LicensePlan = "starter" | "pro" | "enterprise" | "evaluation";

export type LicenseStatus = "active" | "grace" | "expired" | "revoked" | "none";

export interface StoredLicense {
  keyHint: string;
  plan: LicensePlan;
  status: LicenseStatus;
  features: string[];
  expiresAt: string | null;
  customerEmail?: string;
  maxDomains?: number;
  instanceId: string;
  activatedAt: string;
  lastHeartbeatAt: string | null;
  token: string;
  artifactVersion?: string;
}

export interface LicensePublicInfo {
  plan: LicensePlan | "Core evaluation";
  status: LicenseStatus;
  type: string;
  domains: string;
  expiry: string;
  features: string[];
  instanceId: string;
  lastHeartbeatAt: string | null;
  keyHint: string;
  artifactVersion?: string;
  /** Algorithm that verified the license token; absent in heartbeat-trust mode. */
  verifyAlgo?: "EdDSA" | "HS256";
  /** Human-readable reason license is stored but not active. */
  verifyError?: string;
  /** Trust path currently in effect (heartbeat-trust default vs. opt-in crypto). */
  trustMode?: LicenseTrustMode;
  /** Whether the last heartbeat is recent enough to keep the cache trusted. */
  heartbeatFresh?: boolean;
  /** Configured heartbeat grace window (hours). */
  heartbeatGraceHours?: number;
}

type ActivateResponse = {
  token: string;
  plan: LicensePlan;
  status: LicenseStatus;
  features: string[];
  expiresAt: string | null;
  customerEmail?: string;
  maxDomains?: number;
  artifactVersion?: string;
  downloadUrl?: string;
};

type HeartbeatResponse = {
  status: LicenseStatus;
  features: string[];
  expiresAt: string | null;
  token?: string;
  artifactVersion?: string;
  downloadUrl?: string;
};

function licenseServer(): string {
  return (
    process.env.QADBAK_LICENSE_SERVER?.replace(/\/$/, "") ??
    "https://license.omiiba.dev"
  );
}

/** Same-host panel → license API (avoids NAT hairpin on the public hostname). */
function licenseServerFetchBase(): string {
  const internal = process.env.QADBAK_LICENSE_SERVER_INTERNAL?.trim().replace(
    /\/$/,
    "",
  );
  if (internal) return internal;
  return licenseServer();
}

/**
 * License signing secret — only meaningful for *issuing* tokens (dev mode
 * helper {@link issueDevPremiumToken}). Production panels never sign
 * tokens; they receive a token from the license server during activate
 * and refresh it during heartbeat.
 *
 * Throws so dev-mode token issuance fails loudly without configuration.
 */
function requireJwtSecret(): Uint8Array {
  const secret = process.env.QADBAK_LICENSE_JWT_SECRET?.trim();
  if (!secret || secret.length < 16) {
    throw new Error(
      "QADBAK_LICENSE_JWT_SECRET (>=16 chars) is required to issue dev license tokens.",
    );
  }
  return new TextEncoder().encode(secret);
}

/**
 * License *verification* configuration.
 *
 * Security model (default = heartbeat-trust, opt-in = cryptographic):
 *
 * By default Qadbak panels DO NOT cryptographically verify license
 * tokens locally. The license server is the source of truth: a license
 * is only written to data/license.json after a successful activate
 * (token came fresh from the license server) and is only considered
 * active if the most recent heartbeat succeeded recently. This is the
 * same model Stripe / Auth0 / Keygen etc. use — server-side validation
 * with a client-side cache.
 *
 * An attacker who hand-edits data/license.json gets at most one
 * heartbeat-interval (default 6h) of "fake Premium" before the next
 * scheduled heartbeat asks the license server to validate the token,
 * fails, and clears the local file.
 *
 * Operators who want defense-in-depth can opt into cryptographic
 * verification by configuring one of:
 *
 *  - Ed25519 (RECOMMENDED): ship a matching public key at
 *    `config/license-public.pem` (or path in $QADBAK_LICENSE_PUBLIC_KEY).
 *    The license server signs tokens with the corresponding private key.
 *
 *  - HS256 (LEGACY): set $QADBAK_LICENSE_JWT_SECRET to match the license
 *    server's HS256 secret. Only suitable for single-tenant dev setups
 *    where panel and license server share a secret store.
 *
 * When EITHER crypto path is configured, the token MUST verify against
 * it — failing crypto disqualifies the license even if the heartbeat is
 * fresh. This way crypto is a strictness gate, never a footgun.
 */
function tryGetHs256VerifySecret(): Uint8Array | null {
  const secret = process.env.QADBAK_LICENSE_JWT_SECRET?.trim();
  if (!secret || secret.length < 16) return null;
  return new TextEncoder().encode(secret);
}

/** Cached for the lifetime of the panel process; re-read on QADBAK_LICENSE_PUBLIC_KEY change. */
let cachedEd25519Key: { path: string; key: KeyObject } | null = null;

async function tryGetEd25519VerifyKey(): Promise<KeyObject | null> {
  const keyPath =
    process.env.QADBAK_LICENSE_PUBLIC_KEY?.trim() ||
    path.join(process.cwd(), "config", "license-public.pem");
  if (cachedEd25519Key && cachedEd25519Key.path === keyPath) {
    return cachedEd25519Key.key;
  }
  let pem: string;
  try {
    pem = await readFile(keyPath, "utf8");
  } catch {
    cachedEd25519Key = null;
    return null;
  }
  try {
    const key = createPublicKey({ key: pem, format: "pem" });
    if (key.asymmetricKeyType !== "ed25519") {
      // Not an Ed25519 key — used for something else (e.g. RSA). Skip.
      cachedEd25519Key = null;
      return null;
    }
    cachedEd25519Key = { path: keyPath, key };
    return key;
  } catch {
    cachedEd25519Key = null;
    return null;
  }
}

export async function getOrCreateInstanceId(): Promise<string> {
  try {
    const existing = (await readFile(INSTANCE_PATH, "utf8")).trim();
    if (existing) return existing;
  } catch {
    /* create below */
  }
  const id = createHash("sha256")
    .update(`${randomBytes(32).toString("hex")}:${process.cwd()}`)
    .digest("hex")
    .slice(0, 32);
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(INSTANCE_PATH, `${id}\n`, "utf8");
  return id;
}

export async function readStoredLicense(): Promise<StoredLicense | null> {
  try {
    const raw = await readFile(LICENSE_PATH, "utf8");
    const parsed = JSON.parse(raw) as StoredLicense;
    if (!parsed?.token || !parsed?.instanceId) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeStoredLicense(license: StoredLicense): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(LICENSE_PATH, `${JSON.stringify(license, null, 2)}\n`, "utf8");
}

export async function clearStoredLicense(): Promise<void> {
  try {
    await rm(LICENSE_PATH);
  } catch {
    /* already absent */
  }
  const { clearPremiumFeaturesEnv } = await import("./premium/env-sync");
  await clearPremiumFeaturesEnv();
}

function keyHint(key: string): string {
  const k = key.trim();
  if (k.length <= 8) return "****";
  return `${k.slice(0, 4)}…${k.slice(-4)}`;
}

export type LicenseTrustMode = "crypto" | "heartbeat";

export async function verifyLicenseToken(token: string): Promise<{
  valid: boolean;
  payload?: Record<string, unknown>;
  /** Which trust path established the result. */
  mode: LicenseTrustMode;
  /** Which crypto verifier accepted the token; absent when mode=heartbeat. */
  algo?: "EdDSA" | "HS256";
  /** Why crypto verification failed; only populated when valid=false. */
  reason?: string;
}> {
  // 1. Ed25519 with bundled public key (opt-in strict mode).
  const pubKey = await tryGetEd25519VerifyKey();
  if (pubKey) {
    try {
      const { payload } = await jwtVerify(token, pubKey, {
        algorithms: ["EdDSA"],
      });
      return {
        valid: true,
        payload: payload as Record<string, unknown>,
        algo: "EdDSA",
        mode: "crypto",
      };
    } catch (e) {
      return {
        valid: false,
        mode: "crypto",
        reason: `Ed25519 verification failed (${e instanceof Error ? e.message : "invalid signature"}). config/license-public.pem may not match the license server's signing key.`,
      };
    }
  }

  // 2. HS256 with shared secret (opt-in strict mode, legacy).
  const hsSecret = tryGetHs256VerifySecret();
  if (hsSecret) {
    try {
      const { payload } = await jwtVerify(token, hsSecret, {
        algorithms: ["HS256"],
      });
      return {
        valid: true,
        payload: payload as Record<string, unknown>,
        algo: "HS256",
        mode: "crypto",
      };
    } catch (e) {
      return {
        valid: false,
        mode: "crypto",
        reason: `HS256 verification failed (${e instanceof Error ? e.message : "invalid signature"}). QADBAK_LICENSE_JWT_SECRET may not match the license server's secret.`,
      };
    }
  }

  // 3. Default: no crypto path configured → trust the cached license
  // and let isPremiumActive enforce heartbeat freshness instead.
  return { valid: true, mode: "heartbeat" };
}

/**
 * Maximum age of the last successful heartbeat before the cached license
 * is considered stale and downgraded to inactive. Configurable for
 * customers who run on flaky networks; default 48 hours gives ~8 missed
 * heartbeats of grace before lock-out.
 */
function heartbeatGraceMs(): number {
  const env = process.env.QADBAK_HEARTBEAT_GRACE_HOURS?.trim();
  const hours = env ? Number(env) : 48;
  if (!Number.isFinite(hours) || hours <= 0) return 48 * 60 * 60 * 1000;
  return hours * 60 * 60 * 1000;
}

export function isHeartbeatFresh(
  stored: StoredLicense,
  now = Date.now(),
): boolean {
  if (!stored.lastHeartbeatAt) {
    // Never heartbeated since activate — only fresh if activate itself
    // was recent (the activate response IS a heartbeat by another name).
    const activatedAt = Date.parse(stored.activatedAt);
    if (!Number.isFinite(activatedAt)) return false;
    return now - activatedAt < heartbeatGraceMs();
  }
  const lastHb = Date.parse(stored.lastHeartbeatAt);
  if (!Number.isFinite(lastHb)) return false;
  return now - lastHb < heartbeatGraceMs();
}

export function licenseStatus(stored: StoredLicense | null): LicenseStatus {
  if (!stored) return "none";
  if (stored.status === "revoked") return "revoked";
  if (stored.expiresAt) {
    const exp = Date.parse(stored.expiresAt);
    if (!Number.isNaN(exp) && exp < Date.now()) return "expired";
  }
  return stored.status;
}

export function isPremiumLicensed(stored: StoredLicense | null = null): boolean {
  const lic = stored;
  const check = lic ?? null;
  if (!check) return false;
  const status = licenseStatus(check);
  return status === "active" || status === "grace";
}

export async function isPremiumActive(): Promise<boolean> {
  const stored = await readStoredLicense();
  if (!isPremiumLicensed(stored)) return false;
  const verified = await verifyLicenseToken(stored!.token);
  if (!verified.valid) return false; // strict crypto failed
  if (verified.mode === "heartbeat" && !isHeartbeatFresh(stored!)) {
    return false; // no recent heartbeat — refuse to trust stale cache
  }
  return true;
}

export async function getLicensePublicInfo(
  domainCount = 0,
): Promise<LicensePublicInfo> {
  const stored = await readStoredLicense();
  if (!stored || !isPremiumLicensed(stored)) {
    return {
      plan: "Core evaluation",
      status: stored?.status ?? "none",
      type: "Qadbak Core (evaluation)",
      domains: String(domainCount),
      expiry: "N/A — activate Premium for commercial use",
      features: [],
      instanceId: await getOrCreateInstanceId(),
      lastHeartbeatAt: stored?.lastHeartbeatAt ?? null,
      keyHint: stored?.keyHint ?? "—",
      artifactVersion: stored?.artifactVersion,
    };
  }
  // Run the same verification the rest of the panel does so the admin
  // can see WHY a "stored = active" license is being treated as locked.
  const verified = await verifyLicenseToken(stored.token);
  const fresh = isHeartbeatFresh(stored);
  const graceHours = heartbeatGraceMs() / (60 * 60 * 1000);
  // In heartbeat-trust mode, a stale cache is the equivalent of a failed
  // crypto verify — surface it as such so the admin sees one consistent
  // "why am I locked out" message regardless of which trust path is in use.
  const heartbeatStaleError =
    verified.mode === "heartbeat" && !fresh
      ? `last heartbeat is older than the ${graceHours}h grace window — panel cannot reach license.omiiba.dev or the license server hasn't responded. Click "Heartbeat now" to retry.`
      : undefined;
  return {
    plan: stored.plan,
    status: licenseStatus(stored),
    type: `Qadbak Premium (${stored.plan})`,
    domains: String(stored.maxDomains ?? domainCount),
    expiry: stored.expiresAt ?? "Perpetual / not set",
    features: stored.features,
    instanceId: stored.instanceId,
    lastHeartbeatAt: stored.lastHeartbeatAt,
    keyHint: stored.keyHint,
    artifactVersion: stored.artifactVersion,
    verifyAlgo: verified.valid ? verified.algo : undefined,
    verifyError: verified.valid ? heartbeatStaleError : verified.reason,
    trustMode: verified.mode,
    heartbeatFresh: fresh,
    heartbeatGraceHours: graceHours,
  };
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error ??
        `License server error (${res.status})`,
    );
  }
  return data;
}

export async function activateLicense(key: string): Promise<StoredLicense> {
  const instanceId = await getOrCreateInstanceId();
  const hostname =
    process.env.QADBAK_PUBLIC_HOST?.trim() ||
    process.env.HOSTNAME?.trim() ||
    "unknown";
  const data = await postJson<ActivateResponse>(
    `${licenseServerFetchBase()}/v1/activate`,
    { key: key.trim(), instanceId, hostname },
  );
  const now = new Date().toISOString();
  const stored: StoredLicense = {
    keyHint: keyHint(key),
    plan: data.plan,
    status: data.status,
    features: data.features ?? [],
    expiresAt: data.expiresAt,
    customerEmail: data.customerEmail,
    maxDomains: data.maxDomains,
    instanceId,
    activatedAt: now,
    lastHeartbeatAt: now,
    token: data.token,
    artifactVersion: data.artifactVersion,
  };
  await writeStoredLicense(stored);
  const { syncPremiumFeaturesEnv } = await import("./premium/env-sync");
  await syncPremiumFeaturesEnv(stored.features);
  return stored;
}

export async function heartbeatLicense(): Promise<StoredLicense | null> {
  const stored = await readStoredLicense();
  if (!stored) return null;
  const data = await postJson<HeartbeatResponse>(
    `${licenseServerFetchBase()}/v1/heartbeat`,
    { token: stored.token, instanceId: stored.instanceId },
  );
  if (data.status === "revoked") {
    await clearStoredLicense();
    return null;
  }
  const updated: StoredLicense = {
    ...stored,
    status: data.status,
    features: data.features ?? stored.features,
    expiresAt: data.expiresAt ?? stored.expiresAt,
    lastHeartbeatAt: new Date().toISOString(),
    token: data.token ?? stored.token,
    artifactVersion: data.artifactVersion ?? stored.artifactVersion,
  };
  await writeStoredLicense(updated);
  return updated;
}

export async function deactivateLicense(): Promise<void> {
  await clearStoredLicense();
}

/** Local dev / CI: issue a signed evaluation token without license server. */
export async function issueDevPremiumToken(
  features: string[],
): Promise<StoredLicense> {
  if (process.env.QADBAK_ALLOW_DEV_LICENSE !== "true") {
    throw new Error("Dev license only allowed when QADBAK_ALLOW_DEV_LICENSE=true");
  }
  const instanceId = await getOrCreateInstanceId();
  const token = await new SignJWT({
    plan: "pro",
    features,
    instanceId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("365d")
    .sign(requireJwtSecret());
  const stored: StoredLicense = {
    keyHint: "DEV",
    plan: "pro",
    status: "active",
    features,
    expiresAt: null,
    instanceId,
    activatedAt: new Date().toISOString(),
    lastHeartbeatAt: new Date().toISOString(),
    token,
    artifactVersion: "dev",
  };
  await writeStoredLicense(stored);
  return stored;
}

