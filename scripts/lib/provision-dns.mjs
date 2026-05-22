import { readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { emit, fail, resolveDomainUser, fileExists } from "./provisioning-common.mjs";

const exec = promisify(execFile);

async function findZonePath(domain) {
  const candidates = [
    `/etc/bind/${domain}.zone`,
    `/etc/bind/zones/${domain}`,
    `/var/lib/bind/${domain}.host`,
    `/var/lib/bind/${domain}`,
    `/etc/bind/domains/${domain}`,
  ];
  for (const p of candidates) {
    if (await fileExists(p)) return p;
  }
  try {
    const { stdout } = await exec("grep", ["-l", `zone "${domain}"`, "/etc/bind/named.conf.local", "/etc/bind/named.conf"], {
      maxBuffer: 1024 * 1024,
    });
    const conf = stdout.trim().split("\n")[0];
    if (conf) {
      const text = await readFile(conf, "utf8");
      const m = text.match(new RegExp(`zone\\s+"${domain}"[^{]*file\\s+"([^"]+)"`));
      if (m) return m[1].replace(/^\//, "/");
    }
  } catch {
    /* */
  }
  fail(`No BIND zone file found for ${domain}`);
}

function parseZone(text, origin) {
  const records = [];
  let owner = origin;
  for (const raw of text.split("\n")) {
    const line = raw.split(";")[0].trim();
    if (!line || line.startsWith("$")) continue;
    const parts = line.split(/\s+/);
    if (parts.length < 4) continue;
    let idx = 0;
    if (!/^(IN|\d+)$/i.test(parts[1]) && !/^(IN|\d+)$/i.test(parts[2])) {
      if (parts[0] === "@") owner = origin;
      else if (parts[0].endsWith(".")) owner = parts[0].replace(/\.$/, "");
      else owner = `${parts[0]}.${origin}`.replace(/^\./, "");
      idx = 1;
    }
    const ttl = /^\d+$/.test(parts[idx]) ? parts[idx++] : undefined;
    if (parts[idx]?.toUpperCase() === "IN") idx++;
    const type = parts[idx++]?.toUpperCase();
    const value = parts.slice(idx).join(" ").replace(/\.$/, "");
    const name =
      owner === origin
        ? "@"
        : owner.replace(new RegExp(`\\.?${origin.replace(/\./g, "\\.")}$`), "") || "@";
    records.push({ name, type, value, ttl });
  }
  return records;
}

function formatRecordLine(origin, rec) {
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
  const zonePath = await findZonePath(domain);
  let text = await readFile(zonePath, "utf8");
  text += formatRecordLine(domain, record);
  await writeFile(zonePath, text, "utf8");
  try {
    await exec("rndc", ["reload"], { timeout: 30_000 });
  } catch {
    await exec("systemctl", ["reload", "named"], { timeout: 30_000 }).catch(() => {});
  }
  emit({ ok: true });
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
