#!/usr/bin/env node
/**
 * Build + sign a Qadbak Premium artifact tarball.
 *
 * Reads source files from $QADBAK_PREMIUM_SRC (a folder you maintain
 * separately — recommended layout below) and writes
 *
 *   dist/premium/premium-<version>.tar.gz
 *   dist/premium/premium-<version>.tar.gz.sig
 *
 * The signature matches the algorithm the panel verifies with in
 * src/lib/premium/loader.ts:verifySignature — Ed25519 signature over
 * the SHA-256 digest of the tarball bytes (NOT over the file itself).
 *
 * Recommended QADBAK_PREMIUM_SRC layout (mirrors premium.manifest.json):
 *
 *   premium-source/
 *     lib/users-client.js
 *     lib/panel-client-admin.js
 *     lib/updates-helper.js
 *     lib/panel-pm2.js
 *     middleware/client-rbac.js
 *     scripts/php-fpm.mjs
 *     routes/panel-control.js
 *     routes/updates-linux.js
 *     routes/updates-qadbak.js
 *     routes/panel-client.js
 *     components/AdminDashboardPanel.mjs
 *     components/AdminUpdatesView.mjs
 *     components/DomainPanelClientCard.mjs
 *     components/CreateDomainClientOptions.mjs
 *
 * Usage:
 *   QADBAK_PREMIUM_SRC=~/qadbak-premium/dist \
 *   QADBAK_LICENSE_SIGNING_KEY=~/keys/qadbak-license-ed25519.pem \
 *   QADBAK_PREMIUM_VERSION=0.1.0 \
 *   node scripts/premium/build-bundle.mjs
 *
 * Env vars:
 *   QADBAK_PREMIUM_SRC          (required) absolute path of source dir
 *   QADBAK_LICENSE_SIGNING_KEY  (required) PEM file with Ed25519 private key
 *   QADBAK_PREMIUM_VERSION      (optional) override version (default: src/version.txt or src/package.json#version)
 *   QADBAK_PREMIUM_OUT          (optional) output dir (default: ./dist/premium)
 *   QADBAK_PREMIUM_VERIFY_PUBKEY (optional) PEM file with Ed25519 public key — if set, the script verifies its own signature before exiting (useful in CI)
 */

import {
  createHash,
  sign as cryptoSign,
  verify as cryptoVerify,
} from "node:crypto";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function envRequired(name) {
  const v = process.env[name]?.trim();
  if (!v) {
    console.error(`error: ${name} is required (see header of this script).`);
    process.exit(2);
  }
  return v;
}

async function resolveVersion(srcDir) {
  if (process.env.QADBAK_PREMIUM_VERSION?.trim()) {
    return process.env.QADBAK_PREMIUM_VERSION.trim();
  }
  const candidates = ["version.txt", "VERSION", "package.json"];
  for (const name of candidates) {
    const p = path.join(srcDir, name);
    if (!existsSync(p)) continue;
    if (name === "package.json") {
      try {
        const pkg = JSON.parse(await readFile(p, "utf8"));
        if (typeof pkg.version === "string" && pkg.version.length > 0) {
          return pkg.version.trim();
        }
      } catch {
        /* fall through */
      }
    } else {
      const text = (await readFile(p, "utf8")).trim();
      if (text.length > 0) return text;
    }
  }
  throw new Error(
    `Cannot resolve version. Set QADBAK_PREMIUM_VERSION, or add version.txt / package.json#version to ${srcDir}`,
  );
}

async function ensureSourceLayout(srcDir) {
  const st = await stat(srcDir).catch(() => null);
  if (!st?.isDirectory()) {
    throw new Error(`QADBAK_PREMIUM_SRC does not exist or is not a directory: ${srcDir}`);
  }
  // Cross-check with the panel's manifest — warn (don't fail) on missing files.
  const manifestPath = path.join(ROOT, "premium.manifest.json");
  if (!existsSync(manifestPath)) return;
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const expected = new Set();
  for (const v of Object.values(manifest.modules ?? {})) expected.add(v);
  for (const v of Object.values(manifest.handlers ?? {})) expected.add(v);
  for (const v of Object.values(manifest.components ?? {})) expected.add(v);
  const missing = [];
  for (const rel of expected) {
    if (!existsSync(path.join(srcDir, rel))) missing.push(rel);
  }
  if (missing.length > 0) {
    console.warn(
      `warning: ${missing.length} file(s) declared in premium.manifest.json are missing from the source tree:`,
    );
    for (const m of missing.slice(0, 8)) console.warn(`  - ${m}`);
    if (missing.length > 8) console.warn(`  (+ ${missing.length - 8} more)`);
    console.warn(
      "The panel will throw at import time when a Premium page tries to load a missing module.",
    );
  }
}

async function tarballize(srcDir, outFile) {
  // -C srcDir . to preserve relative paths inside the tar (matching how the
  // panel extracts: tar -xzf premium-X.tar.gz -C data/premium/X/, then
  // imports e.g. data/premium/X/lib/users-client.js).
  await execFileAsync(
    "tar",
    ["--format=ustar", "-czf", outFile, "-C", srcDir, "."],
    { maxBuffer: 64 * 1024 * 1024 },
  );
}

async function signTarball(tarballPath, privKeyPath, pubKeyPath) {
  const [tarBuf, privKeyPem] = await Promise.all([
    readFile(tarballPath),
    readFile(privKeyPath, "utf8"),
  ]);
  const digest = createHash("sha256").update(tarBuf).digest();
  // Ed25519 is pure-EdDSA: the one-shot crypto.sign(null, data, key) API
  // is the supported path. The streaming createSign("Ed25519")…sign()
  // pattern errors out with "Invalid digest" on most Node versions
  // because it tries to apply a digest algorithm before signing.
  const sig = cryptoSign(null, digest, privKeyPem);
  const sigPath = `${tarballPath}.sig`;
  await writeFile(sigPath, sig);

  if (pubKeyPath) {
    const pubKeyPem = await readFile(pubKeyPath, "utf8");
    const ok = cryptoVerify(null, digest, pubKeyPem, sig);
    if (!ok) {
      throw new Error(
        "Self-verification failed — signature does not validate against the supplied public key.",
      );
    }
  }
  return { sigPath, digestHex: digest.toString("hex") };
}

async function main() {
  const srcDir = path.resolve(envRequired("QADBAK_PREMIUM_SRC"));
  const privKey = path.resolve(envRequired("QADBAK_LICENSE_SIGNING_KEY"));
  const outDir = path.resolve(
    process.env.QADBAK_PREMIUM_OUT?.trim() || path.join(ROOT, "dist", "premium"),
  );
  const pubKey = process.env.QADBAK_PREMIUM_VERIFY_PUBKEY?.trim()
    ? path.resolve(process.env.QADBAK_PREMIUM_VERIFY_PUBKEY)
    : undefined;

  await ensureSourceLayout(srcDir);
  const version = await resolveVersion(srcDir);

  await mkdir(outDir, { recursive: true });
  const tarball = path.join(outDir, `premium-${version}.tar.gz`);

  console.log(`Building   ${path.relative(ROOT, srcDir)} -> ${path.relative(ROOT, tarball)} (v${version})`);
  await tarballize(srcDir, tarball);

  const tarStat = await stat(tarball);
  console.log(`Signed     ${formatBytes(tarStat.size)} with ${path.basename(privKey)}`);
  const { sigPath, digestHex } = await signTarball(tarball, privKey, pubKey);

  console.log(JSON.stringify(
    {
      ok: true,
      version,
      tarball,
      sig: sigPath,
      bytes: tarStat.size,
      sha256: digestHex,
      verified: Boolean(pubKey),
    },
    null,
    2,
  ));
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

main().catch((e) => {
  console.error(`error: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
