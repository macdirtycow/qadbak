#!/usr/bin/env node
import { readFile, access, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

export const QADBAK_DIR = process.env.QADBAK_DIR || "/opt/qadbak";
const REGISTRY = path.join(QADBAK_DIR, "data", "native-domains.json");

export function emit(obj) {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
}

export function fail(message, code = 1) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

export async function loadRegistry() {
  try {
    const raw = await readFile(REGISTRY, "utf8");
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export async function saveRegistry(rows) {
  await mkdir(path.dirname(REGISTRY), { recursive: true });
  await writeFile(REGISTRY, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
}

export async function resolveDomainUser(domain) {
  const d = String(domain || "").trim().toLowerCase();
  const rows = await loadRegistry();
  const hit = rows.find((r) => String(r.name).toLowerCase() === d);
  if (hit?.user) return { domain: d, user: hit.user, home: `/home/${hit.user}` };
  const base = d.split(".")[0]?.replace(/[^a-z0-9_-]/g, "") || "site";
  const home = `/home/${base}`;
  try {
    await access(home);
    return { domain: d, user: base, home };
  } catch {
    fail(`Unknown domain ${domain} — run export-native-domains.sh or domain-create`);
  }
}

export async function fileExists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}
