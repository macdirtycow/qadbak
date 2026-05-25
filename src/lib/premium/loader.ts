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
  verifyLicenseToken,
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

export interface SyncPremiumOptions {
  /** Pass an open JournalBuilder to record download / extract / reload as journal steps. */
  journal?: PremiumSyncJournal;
}

export interface PremiumSyncJournal {
  infoStep(summary: string): void;
  warnStep(summary: string, errorMessage?: string): void;
  step(opts: {
    kind:
      | "shell"
      | "file-write"
      | "file-delete"
      | "service-reload"
      | "external-http"
      | "external-script"
      | "info"
      | "error";
    summary: string;
    command?: string;
    filePath?: string;
    byteSize?: number;
    output?: string;
    externalUrl?: string;
    ok?: boolean;
    errorMessage?: string;
    durationMs?: number;
  }): void;
}

export interface SyncPremiumResult extends ActivePremiumState {
  /** True iff the version was already extracted on disk before this call. */
  skipped: boolean;
  /** True iff we ran a `pm2 reload` (or fallback) so new handlers are picked up. */
  reloaded: boolean;
  /** Reason we couldn't reload — surface to the operator. */
  reloadError?: string;
}

export async function syncPremiumArtifact(
  opts: SyncPremiumOptions = {},
): Promise<SyncPremiumResult> {
  const j = opts.journal;
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
      "License has no artifact version — your license server has not yet published a Premium build. Run Heartbeat now or re-activate, or check that an artifact has been uploaded server-side.",
    );
  }

  const version = stored.artifactVersion;
  const versionDir = premiumVersionDir(version);
  const marker = path.join(versionDir, ".installed");
  try {
    await access(marker);
    const active = await getActivePremiumState();
    if (active?.version === version) {
      j?.infoStep(`Premium ${version} already installed — skipping download.`);
      return { ...active, skipped: true, reloaded: false };
    }
  } catch {
    /* download */
  }

  const url = artifactDownloadUrl(stored.token, version);
  // Pre-flight HEAD so we can fail fast with a useful message when the
  // license server has not uploaded the artifact yet.
  const head = await fetch(url, { method: "HEAD" }).catch((e) => {
    throw new Error(
      `Could not reach license server for Premium artifact: ${e instanceof Error ? e.message : String(e)}`,
    );
  });
  if (!head.ok) {
    if (head.status === 404) {
      throw new Error(
        `License server has no Premium build for version "${version}" (HTTP 404 at ${url.replace(/\?.*$/, "")}). Build and upload the artifact on the license server, then click Refresh modules again.`,
      );
    }
    if (head.status === 401 || head.status === 403) {
      throw new Error(
        `License server rejected the token for version "${version}" (HTTP ${head.status}). Run Heartbeat now or re-activate the key.`,
      );
    }
    throw new Error(
      `Premium artifact unavailable (HTTP ${head.status} at ${url.replace(/\?.*$/, "")}).`,
    );
  }

  const downloadDir = path.join(PREMIUM_ROOT, "downloads");
  await mkdir(downloadDir, { recursive: true });
  const tarball = path.join(downloadDir, `premium-${version}.tar.gz`);
  const sigFile = `${tarball}.sig`;

  const downloadStart = Date.now();
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Premium download failed (${res.status})`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(tarball, buf);
  j?.step({
    kind: "external-http",
    summary: `Downloaded Premium ${version} (${formatBytes(buf.byteLength)})`,
    externalUrl: url.replace(/\?.*$/, ""),
    byteSize: buf.byteLength,
    durationMs: Date.now() - downloadStart,
  });

  const sigRes = await fetch(`${url}.sig`).catch(() => null);
  if (sigRes?.ok) {
    await writeFile(sigFile, Buffer.from(await sigRes.arrayBuffer()));
    const ok = await verifySignature(tarball, sigFile);
    if (!ok) throw new Error("Premium artifact signature verification failed.");
    j?.infoStep("Verified Ed25519 signature on Premium tarball.");
  } else {
    j?.warnStep(
      "No signature served for this artifact — extraction proceeded without signature check.",
    );
  }

  await rm(versionDir, { recursive: true, force: true });
  await mkdir(versionDir, { recursive: true });
  await extractTarball(tarball, versionDir);
  await writeFile(marker, new Date().toISOString(), "utf8");
  j?.step({
    kind: "file-write",
    summary: `Extracted Premium bundle into data/premium/${version}/`,
    filePath: versionDir,
  });

  const state: ActivePremiumState = {
    version,
    loadedAt: new Date().toISOString(),
    features: stored.features,
  };
  await writeFile(ACTIVE_PATH, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  moduleCache.clear();

  const reload = await reloadPanelProcess();
  if (reload.ok) {
    j?.step({
      kind: "service-reload",
      summary: `Reloaded panel via ${reload.tool} (${reload.target})`,
      command: reload.command,
      durationMs: reload.durationMs,
    });
  } else if (reload.skipped) {
    j?.infoStep(
      `Panel reload skipped: ${reload.skipped}. Run \`pm2 reload qadbak\` manually if Premium menu items stay locked.`,
    );
  } else {
    j?.warnStep(
      "Could not auto-reload the panel — restart pm2 manually.",
      reload.error,
    );
  }

  return {
    ...state,
    skipped: false,
    reloaded: reload.ok,
    reloadError: reload.ok ? undefined : reload.error ?? reload.skipped,
  };
}

interface ReloadResult {
  ok: boolean;
  tool?: "pm2" | "systemctl";
  target?: string;
  command?: string;
  durationMs?: number;
  error?: string;
  skipped?: string;
}

/**
 * Reload the long-running panel process so new Premium handlers are
 * picked up without a manual `pm2 reload`. Tries pm2 first (the
 * canonical Qadbak runtime), falls back to `systemctl restart` for
 * non-pm2 installs. Disable with `QADBAK_AUTO_RELOAD=false`.
 */
async function reloadPanelProcess(): Promise<ReloadResult> {
  if (process.env.QADBAK_AUTO_RELOAD === "false") {
    return { ok: false, skipped: "disabled via QADBAK_AUTO_RELOAD=false" };
  }
  const procName = process.env.QADBAK_PM2_NAME?.trim() || "qadbak";
  const start = Date.now();
  try {
    await execFileAsync("pm2", ["reload", procName], { timeout: 15_000 });
    return {
      ok: true,
      tool: "pm2",
      target: procName,
      command: `pm2 reload ${procName}`,
      durationMs: Date.now() - start,
    };
  } catch (pm2Err) {
    const pm2Msg = pm2Err instanceof Error ? pm2Err.message : String(pm2Err);
    const unit = process.env.QADBAK_SYSTEMD_UNIT?.trim();
    if (!unit) {
      return {
        ok: false,
        error: `pm2 reload failed (${truncate(pm2Msg, 200)}). Set QADBAK_SYSTEMD_UNIT to use systemctl as fallback.`,
      };
    }
    try {
      await execFileAsync("systemctl", ["restart", unit], { timeout: 15_000 });
      return {
        ok: true,
        tool: "systemctl",
        target: unit,
        command: `systemctl restart ${unit}`,
        durationMs: Date.now() - start,
      };
    } catch (sysErr) {
      const sysMsg = sysErr instanceof Error ? sysErr.message : String(sysErr);
      return {
        ok: false,
        error: `pm2 reload failed (${truncate(pm2Msg, 100)}) and systemctl restart ${unit} failed (${truncate(sysMsg, 100)}).`,
      };
    }
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
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
