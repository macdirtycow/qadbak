import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
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
    "https://license.omiiba.com"
  );
}

function getJwtSecret(): Uint8Array {
  const secret =
    process.env.QADBAK_LICENSE_JWT_SECRET?.trim() ||
    process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "QADBAK_LICENSE_JWT_SECRET or SESSION_SECRET required for license storage.",
    );
  }
  return new TextEncoder().encode(secret);
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
}> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      algorithms: ["HS256"],
    });
    return { valid: true, payload: payload as Record<string, unknown> };
  } catch {
    return { valid: false };
  }
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
    `${licenseServer()}/v1/activate`,
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
    `${licenseServer()}/v1/heartbeat`,
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
    .sign(getJwtSecret());
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
  return `${licenseServer()}/v1/artifacts/${encodeURIComponent(version)}/premium.tar.gz?token=${encodeURIComponent(token)}`;
}
