import { readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import {
  emit,
  fail,
  resolveDomainUser,
  fileExists,
  loadRegistry,
  QADBAK_DIR,
} from "./provisioning-common.mjs";
import { validateDnsRecord } from "./validate-dns-record.mjs";
import { assertDomainName, escapeRegExp, escapeShellSingle } from "./security-utils.mjs";

const exec = promisify(execFile);

async function zoneFromRegistry(domain) {
  const rows = await loadRegistry();
  const hit = rows.find((r) => String(r.name).toLowerCase() === domain.toLowerCase());
  return hit?.zoneFile || hit?.zonePath || null;
}

async function zoneFromLegacyHostCli(domain) {
  const bin = process.env.QADBAK_LEGACY_HOST_BIN?.trim();
  if (!bin) return null;
  try {
    const { stdout } = await exec(
      bin,
      ["list-domains", "--domain", domain, "--multiline"],
      { maxBuffer: 2 * 1024 * 1024 },
    );
    for (const line of stdout.split("\n")) {
      const m = line.match(/^(?:DNS zone file|Zone file|Master file):\s*(.+)$/i);
      if (m?.[1]) {
        const p = m[1].trim();
        if (await fileExists(p)) return p;
      }
    }
  } catch {
    /* no CLI */
  }
  return null;
}

async function zoneFromNamedConf(domain) {
  const safeDomain = assertDomainName(domain);
  const confs = [
    "/etc/bind/named.conf.local",
    "/etc/bind/named.conf",
    "/etc/named.conf",
  ];
  for (const conf of confs) {
    if (!(await fileExists(conf))) continue;
    const text = await readFile(conf, "utf8");
    const re = new RegExp(
      `zone\\s+"${escapeRegExp(safeDomain)}"[\\s\\S]*?file\\s+"([^"]+)"`,
      "i",
    );
    const m = text.match(re);
    if (m?.[1]) {
      let p = m[1].trim();
      if (!p.startsWith("/")) p = path.join("/etc/bind", p);
      if (await fileExists(p)) return p;
    }
  }
  return null;
}

async function zoneFromFind(domain) {
  const safeDomain = assertDomainName(domain);
  const names = [
    `${safeDomain}.hosts`,
    `${safeDomain}.host`,
    `${safeDomain}.zone`,
    safeDomain,
    `db.${safeDomain}`,
  ];
  try {
    const { stdout } = await exec(
      "bash",
      [
        "-c",
        `find /var/lib/bind /etc/bind -maxdepth 4 -type f \\( ${names.map((n) => `-name ${escapeShellSingle(n)}`).join(" -o ")} \\) 2>/dev/null | head -1`,
      ],
      { maxBuffer: 1024 * 1024 },
    );
    const p = stdout.trim().split("\n")[0];
    if (p && (await fileExists(p))) return p;
  } catch {
    /* */
  }
  return null;
}

async function locateZonePath(domain) {
  const cached = await zoneFromRegistry(domain);
  if (cached && (await fileExists(cached))) return cached;

  const candidates = [
    `/var/lib/bind/${domain}.hosts`,
    `/var/lib/bind/${domain}.host`,
    `/var/lib/bind/${domain}`,
    `/var/lib/bind/db.${domain}`,
    `/etc/bind/${domain}.zone`,
    `/etc/bind/zones/${domain}`,
    `/etc/bind/domains/${domain}`,
    `/etc/bind/db.${domain}`,
  ];
  for (const p of candidates) {
    if (await fileExists(p)) return p;
  }

  const vm = await zoneFromLegacyHostCli(domain);
  if (vm) return vm;

  const named = await zoneFromNamedConf(domain);
  if (named) return named;

  const found = await zoneFromFind(domain);
  if (found) return found;

  return null;
}

async function domainInRegistry(domain) {
  const rows = await loadRegistry();
  return rows.some((r) => String(r.name).toLowerCase() === domain.toLowerCase());
}

/** Create BIND zone for a panel domain (idempotent). Requires root (provisioning helper). */
export async function ensureBindZone(domain) {
  const existing = await locateZonePath(domain);
  if (existing) return existing;

  const script = path.join(QADBAK_DIR, "scripts", "create-bind-zone.sh");
  if (!(await fileExists(script))) {
    fail(`Missing ${script} — git pull Qadbak`);
  }
  await exec("bash", [script, domain], { timeout: 120_000 });

  const created = await locateZonePath(domain);
  if (!created) {
    fail(`BIND zone creation failed for ${domain}`);
  }
  return created;
}

export async function findZonePath(domain) {
  const hit = await locateZonePath(domain);
  if (hit) return hit;

  if (await domainInRegistry(domain)) {
    return ensureBindZone(domain);
  }

  fail(
    `No BIND zone file for ${domain}. Add the domain in the panel first, or run: sudo bash ${QADBAK_DIR}/scripts/create-bind-zone.sh ${domain}`,
  );
}

/** Collapse BIND multi-line SOA ( ... ) into one line for parsing. */
function normalizeZoneText(text) {
  const out = [];
  let soaLine = null;
  for (const raw of text.split("\n")) {
    const line = raw.split(";")[0].trim();
    if (!line) continue;
    if (soaLine !== null) {
      soaLine += ` ${line}`;
      if (line.includes(")")) {
        out.push(soaLine);
        soaLine = null;
      }
      continue;
    }
    if (/\bSOA\b/i.test(line) && line.includes("(") && !line.includes(")")) {
      soaLine = line;
      continue;
    }
    out.push(line);
  }
  if (soaLine) out.push(soaLine);
  return out.join("\n");
}

function parseZone(text, origin) {
  const records = [];
  for (const raw of normalizeZoneText(text).split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("$")) continue;
    const parts = line.split(/\s+/).filter(Boolean);
    if (parts.length < 3) continue;
    let i = 0;
    let name = "@";
    if (parts[0] === "@") {
      i = 1;
    } else if (!/^\d+$/.test(parts[0]) && !/^IN$/i.test(parts[0])) {
      name = parts[0].replace(/\.$/, "");
      if (name === origin) name = "@";
      else if (name.endsWith(`.${origin}`)) name = name.slice(0, -(origin.length + 1)) || "@";
      i = 1;
    }
    if (/^\d+$/.test(parts[i])) i++;
    if (/^IN$/i.test(parts[i])) i++;
    const type = parts[i++]?.toUpperCase();
    if (!type) continue;
    let value = parts.slice(i).join(" ").replace(/\.$/, "");
    if (type === "SOA") {
      value = value
        .replace(/^\(+/, "")
        .replace(/\)+$/, "")
        .replace(/\s+/g, " ")
        .trim();
    }
    let priority;
    if (type === "MX" || type === "SRV") {
      const m = value.match(/^(\d+)\s+(.+)$/);
      if (m) {
        priority = m[1];
        value = m[2];
      }
    }
    records.push({ name, type, value, ttl: undefined, priority });
  }
  return records;
}

function formatRecordLine(_origin, rec) {
  const name = rec.name === "@" ? "@" : rec.name;
  const ttl = rec.ttl ? `${rec.ttl} ` : "";
  const pri =
    rec.priority && (rec.type === "MX" || rec.type === "SRV") ? `${rec.priority} ` : "";
  return `${name} ${ttl}IN ${rec.type} ${pri}${rec.value}\n`;
}

export async function dnsGet(domain) {
  await resolveDomainUser(domain);
  const zonePath = await findZonePath(domain);
  const text = await readFile(zonePath, "utf8");
  const records = parseZone(text, domain);
  emit({ ok: true, records, zonePath });
}

export async function dnsAdd(domain, record) {
  await resolveDomainUser(domain);
  const safe = validateDnsRecord(record);
  const zonePath = await findZonePath(domain);
  let text = await readFile(zonePath, "utf8");
  text += formatRecordLine(domain, safe);
  await writeFile(zonePath, text, "utf8");
  try {
    await exec("rndc", ["reload"], { timeout: 30_000 });
  } catch {
    await exec("systemctl", ["reload", "named"], { timeout: 30_000 }).catch(() => {});
  }
  emit({ ok: true, zonePath });
}

export async function dnsDel(domain, record) {
  await resolveDomainUser(domain);
  const zonePath = await findZonePath(domain);
  const lines = (await readFile(zonePath, "utf8")).split("\n");
  const needle = `${record.type}`.toUpperCase();
  const filtered = lines.filter((line) => {
    const l = line.toUpperCase();
    if (!l.includes(needle)) return true;
    if (record.name !== "@" && !l.includes(record.name.toUpperCase())) return true;
    if (!l.includes(String(record.value).toUpperCase())) return true;
    return false;
  });
  await writeFile(zonePath, filtered.join("\n"), "utf8");
  try {
    await exec("rndc", ["reload"], { timeout: 30_000 });
  } catch {
    /* */
  }
  emit({ ok: true });
}
