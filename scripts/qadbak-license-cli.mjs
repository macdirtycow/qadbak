#!/usr/bin/env node
/**
 * CLI for license activate, heartbeat, deactivate, and status (used by
 * cron/install). The open-core refactor removed the `sync` subcommand —
 * Premium source ships in this repo, so there is no artifact to
 * download. `git pull && npm run build && pm2 restart` is the entire
 * update flow for Core and Premium customers alike.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(ROOT);

/** Load panel .env.local so activate/heartbeat see QADBAK_LICENSE_* when run from install/CLI. */
async function loadEnvLocal() {
  try {
    const raw = await readFile(path.join(ROOT, ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 1) continue;
      const k = t.slice(0, i).trim();
      if (!k || process.env[k] !== undefined) continue;
      let v = t.slice(i + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      process.env[k] = v;
    }
  } catch {
    /* optional */
  }
}

async function readLicenseJson() {
  try {
    const raw = await readFile(path.join(ROOT, "data", "license.json"), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Keep in sync with src/lib/premium/env-sync.ts */
async function syncPremiumFeaturesEnv(features) {
  const envPath = path.join(ROOT, ".env.local");
  const line = `QADBAK_PREMIUM_FEATURES=${(features ?? []).join(",")}`;
  let content = "";
  try {
    content = await readFile(envPath, "utf8");
  } catch {
    content = "";
  }
  if (/^QADBAK_PREMIUM_FEATURES=/m.test(content)) {
    content = content.replace(/^QADBAK_PREMIUM_FEATURES=.*$/m, line);
  } else {
    content = `${content.trimEnd()}\n${line}\n`;
  }
  await writeFile(envPath, content, "utf8");
}

async function postLicenseServer(pathname, body) {
  const server =
    process.env.QADBAK_LICENSE_SERVER_INTERNAL?.trim().replace(/\/$/, "") ??
    process.env.QADBAK_LICENSE_SERVER?.replace(/\/$/, "") ??
    "https://license.inveil.dev";
  const url = `${server}${pathname}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data.error ?? `HTTP ${res.status}`;
    if (res.status === 404 && err === "Not found") {
      throw new Error(
        `Not found — ${url} is not the license API. Set QADBAK_LICENSE_SERVER=https://license.inveil.dev and remove QADBAK_LICENSE_SERVER_INTERNAL unless the license server runs on this host.`,
      );
    }
    throw new Error(err);
  }
  return data;
}

async function getInstanceId() {
  try {
    return (await readFile(path.join(ROOT, "data", "instance-id"), "utf8")).trim();
  } catch {
    const { randomBytes, createHash } = await import("node:crypto");
    const { mkdir, writeFile } = await import("node:fs/promises");
    const id = createHash("sha256")
      .update(`${randomBytes(32).toString("hex")}:${ROOT}`)
      .digest("hex")
      .slice(0, 32);
    await mkdir(path.join(ROOT, "data"), { recursive: true });
    await writeFile(path.join(ROOT, "data", "instance-id"), `${id}\n`, "utf8");
    return id;
  }
}

async function licenseMeta() {
  const { readFileSync, existsSync } = await import("node:fs");
  let panelVersion = process.env.QADBAK_PANEL_VERSION?.trim() || "";
  if (!panelVersion) {
    try {
      const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
      panelVersion = pkg.version || "0.0.0";
    } catch {
      panelVersion = "0.0.0";
    }
  }
  const publicHost =
    process.env.QADBAK_PUBLIC_HOST?.trim() ||
    process.env.HOSTNAME?.trim() ||
    "unknown";
  let fingerprintTag = null;
  try {
    const envPath = path.join(ROOT, ".env.local");
    if (existsSync(envPath)) {
      const raw = readFileSync(envPath, "utf8");
      const m = raw.match(/^QADBAK_INSTALL_SALT=(.+)$/m);
      const salt = m?.[1]?.trim().replace(/^["']|["']$/g, "");
      if (salt) fingerprintTag = `qb-${salt.slice(0, 12)}`;
    }
  } catch {
    /* */
  }
  return { fingerprintTag, panelVersion, publicHost };
}

async function activate(key) {
  const instanceId = await getInstanceId();
  const meta = await licenseMeta();
  const data = await postLicenseServer("/v1/activate", {
    key,
    instanceId,
    hostname: meta.publicHost,
    publicHost: meta.publicHost,
    fingerprintTag: meta.fingerprintTag,
    panelVersion: meta.panelVersion,
  });
  const { writeFile, mkdir } = await import("node:fs/promises");
  const now = new Date().toISOString();
  const stored = {
    keyHint: key.length > 8 ? `${key.slice(0, 4)}…${key.slice(-4)}` : "****",
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
  await mkdir(path.join(ROOT, "data"), { recursive: true });
  await writeFile(
    path.join(ROOT, "data", "license.json"),
    `${JSON.stringify(stored, null, 2)}\n`,
    "utf8",
  );
  await syncPremiumFeaturesEnv(stored.features);
  console.log(JSON.stringify({ ok: true, plan: data.plan, features: data.features }));
}

async function heartbeat() {
  const stored = await readLicenseJson();
  if (!stored?.token) {
    console.log(JSON.stringify({ ok: true, skipped: true, reason: "no license" }));
    return;
  }
  const meta = await licenseMeta();
  const data = await postLicenseServer("/v1/heartbeat", {
    token: stored.token,
    instanceId: stored.instanceId,
    fingerprintTag: meta.fingerprintTag,
    panelVersion: meta.panelVersion,
    publicHost: meta.publicHost,
  });
  if (data.status === "revoked") {
    const { rm } = await import("node:fs/promises");
    await rm(path.join(ROOT, "data", "license.json")).catch(() => {});
    console.log(JSON.stringify({ ok: true, revoked: true }));
    return;
  }
  const updated = {
    ...stored,
    status: data.status,
    features: data.features ?? stored.features,
    expiresAt: data.expiresAt ?? stored.expiresAt,
    lastHeartbeatAt: new Date().toISOString(),
    token: data.token ?? stored.token,
    artifactVersion: data.artifactVersion ?? stored.artifactVersion,
  };
  const { writeFile } = await import("node:fs/promises");
  await writeFile(
    path.join(ROOT, "data", "license.json"),
    `${JSON.stringify(updated, null, 2)}\n`,
    "utf8",
  );
  await syncPremiumFeaturesEnv(updated.features);
  console.log(
    JSON.stringify({ ok: true, status: data.status, features: updated.features }),
  );
}

async function status() {
  const stored = await readLicenseJson();
  console.log(JSON.stringify({ ok: true, license: stored }));
}

async function deactivate() {
  const { rm } = await import("node:fs/promises");
  await rm(path.join(ROOT, "data", "license.json")).catch(() => {});
  console.log(JSON.stringify({ ok: true, deactivated: true }));
}

const cmd = process.argv[2];
const arg = process.argv[3];

await loadEnvLocal();

try {
  if (cmd === "activate" && arg) await activate(arg);
  else if (cmd === "heartbeat") await heartbeat();
  else if (cmd === "status") await status();
  else if (cmd === "deactivate") await deactivate();
  else {
    console.error(
      "Usage: qadbak-license-cli.mjs <activate KEY|heartbeat|deactivate|status>",
    );
    process.exit(1);
  }
} catch (e) {
  console.error(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }));
  process.exit(1);
}
