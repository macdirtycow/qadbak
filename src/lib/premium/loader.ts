import "server-only";
import { createHash, createVerify } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  artifactDownloadUrl,
  isPremiumActive,
  isPremiumLicensed,
  licenseStatus,
  readStoredLicense,
} from "../qadbak-license";
import { PREMIUM_MANIFEST } from "./manifest";
import type { LoadedPremiumModule, PremiumHandler } from "./types";

const execFileAsync = promisify(execFile);
const PREMIUM_ROOT = path.join(process.cwd(), "data", "premium");
const ACTIVE_PATH = path.join(PREMIUM_ROOT, "active.json");

type ActivePremiumState = {
  version: string;
  loadedAt: string;
  features: string[];
};

const moduleCache = new Map<string, LoadedPremiumModule>();

export async function getActivePremiumState(): Promise<ActivePremiumState | null> {
  try {
    const raw = await readFile(ACTIVE_PATH, "utf8");
    return JSON.parse(raw) as ActivePremiumState;
  } catch {
    return null;
  }
}

/** License valid and Premium bundle extracted under data/premium/. */
export async function isPremiumModulesSynced(): Promise<boolean> {
  if (!(await isPremiumActive())) return false;
  const active = await getActivePremiumState();
  if (!active?.version || !active.features?.length) return false;
  try {
    await access(path.join(premiumVersionDir(active.version), ".installed"));
    return true;
  } catch {
    return false;
  }
}

export async function isPremiumFeatureEnabled(
  featureId: string,
): Promise<boolean> {
  if (!(await isPremiumModulesSynced())) return false;
  const stored = await readStoredLicense();
  if (!stored?.features.includes(featureId)) return false;
  const active = await getActivePremiumState();
  return Boolean(active?.features.includes(featureId));
}

function premiumVersionDir(version: string): string {
  return path.join(PREMIUM_ROOT, version);
}

async function verifySignature(
  tarballPath: string,
  sigPath: string,
): Promise<boolean> {
  const pubKeyPath =
    process.env.QADBAK_LICENSE_PUBLIC_KEY ??
    path.join(process.cwd(), "config", "license-public.pem");
  try {
    const [sig, key] = await Promise.all([
      readFile(sigPath),
      readFile(pubKeyPath, "utf8"),
    ]);
    const hash = createHash("sha256");
    await pipeline(createReadStream(tarballPath), hash);
    const digest = hash.digest();
    return createVerify("Ed25519").update(digest).verify(key, sig);
  } catch {
    return process.env.QADBAK_SKIP_SIGNATURE_VERIFY === "true";
  }
}

async function extractTarball(tarball: string, dest: string): Promise<void> {
  await mkdir(dest, { recursive: true });
  await execFileAsync("tar", ["-xzf", tarball, "-C", dest]);
}

export async function syncPremiumArtifact(): Promise<ActivePremiumState> {
  const stored = await readStoredLicense();
  if (!stored) {
    throw new Error("No license on this server — activate a key first.");
  }
  if (!isPremiumLicensed(stored)) {
    throw new Error(
      `License status is ${licenseStatus(stored)} — cannot download Premium modules.`,
    );
  }
  const verified = await verifyLicenseToken(stored.token);
  if (!verified.valid) {
    throw new Error(
      "License token is invalid (JWT secret mismatch or expired). Run Heartbeat now or re-activate your key.",
    );
  }
  if (!stored.artifactVersion) {
    throw new Error(
      "License has no artifact version — run Heartbeat now or re-activate.",
    );
  }

  const version = stored.artifactVersion;
  const versionDir = premiumVersionDir(version);
  const marker = path.join(versionDir, ".installed");
  try {
    await access(marker);
    const active = await getActivePremiumState();
    if (active?.version === version) return active;
  } catch {
    /* download */
  }

  const downloadDir = path.join(PREMIUM_ROOT, "downloads");
  await mkdir(downloadDir, { recursive: true });
  const tarball = path.join(downloadDir, `premium-${version}.tar.gz`);
  const sigFile = `${tarball}.sig`;

  const url = artifactDownloadUrl(stored.token, version);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Premium download failed (${res.status})`);
  }
  await writeFile(tarball, Buffer.from(await res.arrayBuffer()));

  const sigRes = await fetch(`${url}.sig`).catch(() => null);
  if (sigRes?.ok) {
    await writeFile(sigFile, Buffer.from(await sigRes.arrayBuffer()));
    const ok = await verifySignature(tarball, sigFile);
    if (!ok) throw new Error("Premium artifact signature verification failed.");
  }

  await rm(versionDir, { recursive: true, force: true });
  await mkdir(versionDir, { recursive: true });
  await extractTarball(tarball, versionDir);
  await writeFile(marker, new Date().toISOString(), "utf8");

  const state: ActivePremiumState = {
    version,
    loadedAt: new Date().toISOString(),
    features: stored.features,
  };
  await writeFile(ACTIVE_PATH, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  moduleCache.clear();
  return state;
}

async function resolveModule(relativePath: string): Promise<LoadedPremiumModule> {
  const active = await getActivePremiumState();
  if (!active) throw new Error("Premium not loaded. Run license sync.");
  const fullPath = path.join(premiumVersionDir(active.version), relativePath);
  const cacheKey = fullPath;
  if (moduleCache.has(cacheKey)) return moduleCache.get(cacheKey)!;
  const mod = (await import(/* webpackIgnore: true */ `file://${fullPath}`)) as LoadedPremiumModule;
  moduleCache.set(cacheKey, mod);
  return mod;
}

export async function loadPremiumHandler(
  handlerId: string,
): Promise<{
  GET?: PremiumHandler;
  POST?: PremiumHandler;
  PATCH?: PremiumHandler;
  DELETE?: PremiumHandler;
} | null> {
  const rel = PREMIUM_MANIFEST.handlers[handlerId];
  if (!rel) return null;
  return (await resolveModule(rel)) as {
    GET?: PremiumHandler;
    POST?: PremiumHandler;
  };
}

export async function loadPremiumModule<T = LoadedPremiumModule>(
  featureId: keyof typeof PREMIUM_MANIFEST.modules,
): Promise<T | null> {
  if (!(await isPremiumFeatureEnabled(featureId))) return null;
  const rel = PREMIUM_MANIFEST.modules[featureId];
  if (!rel) return null;
  return (await resolveModule(rel)) as T;
}

export async function listPremiumVersions(): Promise<string[]> {
  try {
    const entries = await readdir(PREMIUM_ROOT);
    return entries.filter((e) => e !== "downloads" && e !== "active.json");
  } catch {
    return [];
  }
}
