#!/usr/bin/env node
/**
 * Download and extract Premium bundle from license server (CLI / cron).
 * Requires active data/license.json and QADBAK_LICENSE_* in environment or .env.local.
 */
import { createHash, createVerify } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function loadEnvLocal() {
  const envPath = path.join(ROOT, ".env.local");
  try {
    const raw = await readFile(envPath, "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!m || process.env[m[1]]) continue;
      let v = m[2].trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      process.env[m[1]] = v;
    }
  } catch {
    /* optional */
  }
}

function licenseServer() {
  return (
    process.env.QADBAK_LICENSE_SERVER?.replace(/\/$/, "") ??
    "https://license.omiiba.dev"
  );
}

function artifactUrl(token, version) {
  return `${licenseServer()}/v1/artifacts/${encodeURIComponent(version)}/premium.tar.gz?token=${encodeURIComponent(token)}`;
}

async function verifySignature(tarball, sigFile) {
  const pubKeyPath =
    process.env.QADBAK_LICENSE_PUBLIC_KEY ??
    path.join(ROOT, "config", "license-public.pem");
  try {
    const [sig, key] = await Promise.all([
      readFile(sigFile),
      readFile(pubKeyPath, "utf8"),
    ]);
    const hash = createHash("sha256");
    await pipeline(createReadStream(tarball), hash);
    return createVerify("Ed25519").update(hash.digest()).verify(key, sig);
  } catch {
    return process.env.QADBAK_SKIP_SIGNATURE_VERIFY === "true";
  }
}

async function main() {
  await loadEnvLocal();
  const licPath = path.join(ROOT, "data", "license.json");
  const raw = await readFile(licPath, "utf8");
  const stored = JSON.parse(raw);
  if (!stored?.token || !stored?.artifactVersion) {
    throw new Error("No active license in data/license.json — run activate first.");
  }
  const version = stored.artifactVersion;
  const premiumRoot = path.join(ROOT, "data", "premium");
  const versionDir = path.join(premiumRoot, version);
  const marker = path.join(versionDir, ".installed");
  try {
    await access(marker);
    console.log(JSON.stringify({ ok: true, skipped: true, version }));
    return;
  } catch {
    /* download */
  }

  const downloadDir = path.join(premiumRoot, "downloads");
  await mkdir(downloadDir, { recursive: true });
  const tarball = path.join(downloadDir, `premium-${version}.tar.gz`);
  const sigFile = `${tarball}.sig`;
  const url = artifactUrl(stored.token, version);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Premium download failed (${res.status})`);
  }
  await writeFile(tarball, Buffer.from(await res.arrayBuffer()));

  const sigRes = await fetch(`${url}.sig`).catch(() => null);
  if (sigRes?.ok) {
    await writeFile(sigFile, Buffer.from(await sigRes.arrayBuffer()));
    if (!(await verifySignature(tarball, sigFile))) {
      throw new Error("Premium artifact signature verification failed.");
    }
  }

  await rm(versionDir, { recursive: true, force: true });
  await mkdir(versionDir, { recursive: true });
  await execFileAsync("tar", ["-xzf", tarball, "-C", versionDir]);

  const features = stored.features ?? [];
  await writeFile(marker, new Date().toISOString(), "utf8");
  await writeFile(
    path.join(premiumRoot, "active.json"),
    `${JSON.stringify({
      version,
      loadedAt: new Date().toISOString(),
      features,
    }, null, 2)}\n`,
  );

  const envLine = `QADBAK_PREMIUM_FEATURES=${features.join(",")}\n`;
  const envPath = path.join(ROOT, ".env.local");
  let envRaw = "";
  try {
    envRaw = await readFile(envPath, "utf8");
  } catch {
    /* new */
  }
  if (/^QADBAK_PREMIUM_FEATURES=/m.test(envRaw)) {
    envRaw = envRaw.replace(/^QADBAK_PREMIUM_FEATURES=.*$/m, envLine.trim());
  } else {
    envRaw = `${envRaw.trimEnd()}\n${envLine}`;
  }
  await writeFile(envPath, envRaw.endsWith("\n") ? envRaw : `${envRaw}\n`);

  console.log(JSON.stringify({ ok: true, version, features }));
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e.message }));
  process.exit(1);
});
