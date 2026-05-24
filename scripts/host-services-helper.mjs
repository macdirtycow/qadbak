#!/usr/bin/env node
/**
 * List/control allowlisted systemd units for Qadbak admin (phase 4).
 * Usage: host-services-helper.mjs list|status|start|stop|restart <unit>
 */
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
const QADBAK_DIR = process.env.QADBAK_DIR || "/opt/qadbak";
const REGISTRY = path.join(QADBAK_DIR, "data", "native-domains.json");

/** Unit names without .service suffix */
const ALLOWED = [
  "nginx",
  "apache2",
  "httpd",
  "postfix",
  "dovecot",
  "named",
  "bind9",
  "mariadb",
  "mysql",
  "php8.4-fpm",
  "php8.3-fpm",
  "php8.2-fpm",
  "php8.1-fpm",
  "php-fpm",
];

function unitName(name) {
  const base = name.replace(/\.service$/i, "");
  if (!ALLOWED.includes(base)) {
    throw new Error(`Service not allowed: ${base}`);
  }
  return `${base}.service`;
}

async function isActive(unit) {
  try {
    const { stdout } = await exec("systemctl", ["is-active", unit], { timeout: 8000 });
    const state = stdout.trim();
    return state === "active" || state === "activating" ? "running" : state;
  } catch (e) {
    const code = e?.code;
    if (code === 3 || code === 4) return "stopped";
    return "unknown";
  }
}

async function cmdList() {
  const services = [];
  for (const base of ALLOWED) {
    const unit = `${base}.service`;
    try {
      await exec("systemctl", ["cat", unit], { timeout: 3000 });
    } catch {
      continue;
    }
    const status = await isActive(unit);
    services.push({ service: base, status, unit });
  }
  return { ok: true, services };
}

async function cmdControl(action, name) {
  const unit = unitName(name);
  await exec("systemctl", [action, unit], { timeout: 120_000 });
  const status = await isActive(unit);
  return { ok: true, service: name.replace(/\.service$/i, ""), status, action };
}

async function cmdBandwidth() {
  let rows = [];
  try {
    const raw = await readFile(REGISTRY, "utf8");
    const parsed = JSON.parse(raw);
    rows = Array.isArray(parsed) ? parsed : [];
  } catch {
    return { ok: true, bandwidth: [] };
  }
  const bandwidth = [];
  for (const row of rows) {
    const name = String(row.name || "").trim();
    const user = String(row.user || "").trim();
    if (!name || !user) continue;
    const home = `/home/${user}`;
    let used = "0";
    try {
      const { stdout } = await exec("du", ["-sm", home], { timeout: 120_000 });
      used = stdout.split("\t")[0]?.trim() || "0";
    } catch {
      /* */
    }
    let limit = row.disk_limit ? String(row.disk_limit) : "";
    if (!limit) {
      try {
        const cfgPath = path.join(
          QADBAK_DIR,
          "data",
          "domain-config",
          name.toLowerCase(),
          "limits.json",
        );
        const cfg = JSON.parse(await readFile(cfgPath, "utf8"));
        limit = cfg.disk ? String(cfg.disk) : "";
      } catch {
        /* */
      }
    }
    bandwidth.push({
      domain: name,
      used,
      limit: limit || "—",
    });
  }
  bandwidth.sort((a, b) => a.domain.localeCompare(b.domain));
  return { ok: true, bandwidth };
}

async function main() {
  const [action, arg] = process.argv.slice(2);
  let result;
  if (action === "list") {
    result = await cmdList();
  } else if (action === "bandwidth") {
    result = await cmdBandwidth();
  } else if (["start", "stop", "restart", "status"].includes(action) && arg) {
    if (action === "status") {
      const unit = unitName(arg);
      result = {
        ok: true,
        service: arg.replace(/\.service$/i, ""),
        status: await isActive(unit),
      };
    } else {
      result = await cmdControl(action, arg);
    }
  } else {
    console.error(
      JSON.stringify({
        ok: false,
        error: "Usage: list | bandwidth | start|stop|restart|status <unit>",
      }),
    );
    process.exit(1);
  }
  console.log(JSON.stringify(result));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message ?? String(err) }));
  process.exit(1);
});
