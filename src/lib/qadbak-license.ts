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
  /** Algorithm that verified the license token; absent if unverified. */
  verifyAlgo?: "EdDSA" | "HS256";
  /** Human-readable reason license is stored but not active. */
  verifyError?: string;
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
 * Security model:
 *
 * The panel MUST have a real way to verify license tokens. The historical
 * fallback that returned valid:true when no key was configured was a
 * security gap — anyone able to write data/license.json on the panel
 * host could mint themselves Premium for free. That mode is gone.
 *
 * Two supported verification paths, tried in order:
 *
 *  1. Ed25519 (asymmetric, RECOMMENDED). The license server signs each
 *     token with its private Ed25519 key. Every panel ships with the
 *     matching public key at `config/license-public.pem` (or the path
 *     in $QADBAK_LICENSE_PUBLIC_KEY). The public key is safe to
 *     distribute — it cannot mint tokens.
 *
 *  2. HS256 (symmetric, LEGACY). If $QADBAK_LICENSE_JWT_SECRET is set
 *     AND matches the license server's HS256 secret, tokens issued with
 *     that secret will verify. Only useful in single-tenant dev setups
 *     where panel and license server share a process or secret store.
 *
 * If neither path is configured (no public key on disk AND no shared
 * secret), the verifier returns invalid. That is the correct behaviour
 * — silently accepting unverified license claims would let a curious
 * customer hand-edit data/license.json to unlock Premium.
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
  await rm(path.join(DATA_DIR, "premium"), { recursive: true, force: true });
  const { clearPremiumFeaturesEnv } = await import("./premium/env-sync");
  await clearPremiumFeaturesEnv();
}

function keyHint(key: string): string {
  const k = key.trim();
  if (k.length <= 8) return "****";
  return `${k.slice(0, 4)}…${k.slice(-4)}`;
}

export async function verifyLicenseToken(token: string): Promise<{
  valid: boolean;
  payload?: Record<string, unknown>;
  /** Which verifier accepted the token; useful for /admin/license diagnostics. */
  algo?: "EdDSA" | "HS256";
  /** Why verification failed; only populated when valid is false. */
  reason?: string;
}> {
  // 1. Ed25519 with bundled public key (recommended).
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
      };
    } catch {
      /* fall through to HS256 */
    }
  }

  // 2. HS256 with shared secret (legacy; only if explicitly configured).
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
      };
    } catch {
      return {
        valid: false,
        reason: pubKey
          ? "token did not verify with the bundled Ed25519 public key OR the shared HS256 secret"
          : "token did not verify with the shared HS256 secret (and no Ed25519 public key is bundled)",
      };
    }
  }

  if (pubKey) {
    return {
      valid: false,
      reason:
        "token did not verify with the bundled Ed25519 public key — license server may still be issuing HS256 tokens; either upgrade the license server to Ed25519 or set QADBAK_LICENSE_JWT_SECRET on this panel",
    };
  }

  return {
    valid: false,
    reason:
      "no verification key configured — bundle config/license-public.pem (Ed25519) into the panel OR set QADBAK_LICENSE_JWT_SECRET. See docs/COMMERCIAL.md.",
  };
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
  return verified.valid;
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
    verifyError: verified.valid ? undefined : verified.reason,
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

export function artifactDownloadUrl(
  token: string,
  version: string,
): string {
  return `${licenseServerFetchBase()}/v1/artifacts/${encodeURIComponent(version)}/premium.tar.gz?token=${encodeURIComponent(token)}`;
}
