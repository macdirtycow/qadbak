#!/usr/bin/env node
/**
 * CLI for license activate, heartbeat, sync, and status (used by cron/install).
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(ROOT);

async function loadLicenseModule() {
  const modPath = path.join(ROOT, ".next", "server", "chunks", "qadbak-license.js");
  try {
    return await import(pathToFileURL(modPath).href);
  } catch {
    /* dev / pre-build: dynamic import via ts not available — use fetch to local API or inline */
    return null;
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

async function postLicenseServer(pathname, body) {
  const server =
    process.env.QADBAK_LICENSE_SERVER?.replace(/\/$/, "") ??
    "https://license.omiiba.com";
  const res = await fetch(`${server}${pathname}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
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

async function activate(key) {
  const instanceId = await getInstanceId();
  const data = await postLicenseServer("/v1/activate", {
    key,
    instanceId,
    hostname: process.env.QADBAK_PUBLIC_HOST ?? process.env.HOSTNAME ?? "unknown",
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
  console.log(JSON.stringify({ ok: true, plan: data.plan, features: data.features }));
}

async function heartbeat() {
  const stored = await readLicenseJson();
  if (!stored?.token) {
    console.log(JSON.stringify({ ok: true, skipped: true, reason: "no license" }));
    return;
  }
  const data = await postLicenseServer("/v1/heartbeat", {
    token: stored.token,
    instanceId: stored.instanceId,
  });
  if (data.status === "revoked") {
    const { rm } = await import("node:fs/promises");
    await rm(path.join(ROOT, "data", "license.json")).catch(() => {});
    await rm(path.join(ROOT, "data", "premium"), { recursive: true, force: true });
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
  console.log(JSON.stringify({ ok: true, status: data.status }));
}

async function status() {
  const stored = await readLicenseJson();
  console.log(JSON.stringify({ ok: true, license: stored }));
}

const cmd = process.argv[2];
const arg = process.argv[3];

try {
  if (cmd === "activate" && arg) await activate(arg);
  else if (cmd === "heartbeat") await heartbeat();
  else if (cmd === "status") await status();
  else if (cmd === "sync") {
    await heartbeat();
    console.log(JSON.stringify({ ok: true, note: "Run panel Refresh modules or npm run build after sync" }));
  } else {
    console.error("Usage: qadbak-license-cli.mjs <activate KEY|heartbeat|status|sync>");
    process.exit(1);
  }
} catch (e) {
  console.error(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }));
  process.exit(1);
}
