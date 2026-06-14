import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { backupNewestAgeDays } from "./provision-backup.mjs";
import {
  emit,
  fail,
  loadRegistry,
  QADBAK_DIR,
  readDomainConfigJson,
} from "./provisioning-common.mjs";

const exec = promisify(execFile);

function parseCrontabInline(text) {
  const lines = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const parts = line.split(/\s+/);
    if (parts.length < 6) continue;
    lines.push({
      schedule: parts.slice(0, 5).join(" "),
      command: parts.slice(5).join(" "),
      raw: line,
    });
  }
  return lines;
}

export async function systemCronList() {
  let jobs = [];
  try {
    const { stdout } = await exec("crontab", ["-l"], { maxBuffer: 1024 * 1024 });
    jobs = parseCrontabInline(stdout);
  } catch (e) {
    if (!String(e).includes("no crontab")) {
      fail(e instanceof Error ? e.message : String(e));
    }
  }
  emit({ ok: true, jobs, scope: "root" });
}

export async function systemAwstatsSummary() {
  const registry = await loadRegistry();
  const domains = (Array.isArray(registry) ? registry : [])
    .map((d) => String(d.name || d.domain || "").trim())
    .filter(Boolean);
  const rows = [];
  const live = "/etc/awstats";
  let awstatsInstalled = false;
  try {
    await exec("which", ["awstats"]);
    awstatsInstalled = true;
  } catch {
    /* */
  }
  for (const domain of domains) {
    const conf = `/etc/awstats/awstats.${domain}.conf`;
    const dataDir = path.join(QADBAK_DIR, "data", "domain-config", domain, "awstats");
    let configured = false;
    try {
      await access(conf);
      configured = true;
    } catch {
      /* */
    }
    const cfg = await readDomainConfigJson(domain, "awstats.json", { enabled: true }).catch(() => ({
      enabled: true,
    }));
    rows.push({
      domain,
      configured,
      enabled: Boolean(cfg.enabled),
      configPath: conf,
      dataDir,
    });
  }
  emit({
    ok: true,
    awstatsInstalled,
    domains: rows,
    total: rows.length,
    configured: rows.filter((r) => r.configured).length,
  });
}

async function sslDaysLeft(domain) {
  const live = "/etc/letsencrypt/live";
  const hosts = [domain, `www.${domain}`];
  let best = null;
  for (const host of hosts) {
    const fullchain = path.join(live, host, "fullchain.pem");
    try {
      await access(fullchain);
      const { stdout } = await exec("openssl", ["x509", "-enddate", "-noout", "-in", fullchain]);
      const exp = new Date(stdout.replace("notAfter=", "").trim()).getTime();
      const days = Math.ceil((exp - Date.now()) / 86_400_000);
      if (best === null || days < best) best = days;
    } catch {
      /* */
    }
  }
  return best;
}

export async function domainHealthBatch() {
  const registry = await loadRegistry();
  const domains = Array.isArray(registry) ? registry : [];
  const items = [];
  for (const row of domains) {
    const name = String(row.name || row.domain || "").trim();
    if (!name) continue;
    if (row.demoOnly === true) continue;
    const disabled = row.disabled === true || row.disabled === "1" || row.disabled === 1;
    const diskUsed = parseFloat(String(row.disk_used ?? row.diskUsed ?? "0")) || 0;
    const diskLimit = parseFloat(String(row.disk_limit ?? row.diskLimit ?? "0")) || null;
    const sslDays = await sslDaysLeft(name);
    let backupAge = null;
    try {
      backupAge = await backupNewestAgeDays(name);
    } catch {
      backupAge = null;
    }
    const actions = [];
    if (sslDays !== null && sslDays <= 14) {
      actions.push({
        label: sslDays <= 0 ? "SSL expired" : `SSL expires in ${sslDays}d`,
        href: `/domains/${encodeURIComponent(name)}/ssl`,
        severity: sslDays <= 7 ? "error" : "warning",
      });
    }
    if (backupAge === null || backupAge > 7) {
      actions.push({
        label: backupAge === null ? "No backup found" : `Last backup ${backupAge}d ago`,
        href: `/domains/${encodeURIComponent(name)}/backups`,
        severity: backupAge === null || backupAge > 14 ? "error" : "warning",
      });
    }
    if (diskLimit && diskUsed / diskLimit > 0.85) {
      actions.push({
        label: "Disk nearly full",
        href: `/domains/${encodeURIComponent(name)}`,
        severity: diskUsed / diskLimit > 0.95 ? "error" : "warning",
      });
    }
    items.push({
      domain: name,
      disabled,
      sslDaysLeft: sslDays,
      backupAgeDays: backupAge,
      diskUsedMb: diskUsed,
      diskLimitMb: diskLimit,
      websiteOk: disabled ? false : null,
      mailOk: true,
      actions,
    });
  }
  emit({ ok: true, domains: items });
}

export async function nodesRemoteProvision(payloadJson) {
  const payload = typeof payloadJson === "string" ? JSON.parse(payloadJson) : payloadJson;
  const agentUrl = String(payload.agentUrl || "").replace(/\/$/, "");
  const domain = String(payload.domain || "").trim();
  const user = String(payload.user || domain.split(".")[0]).trim();
  const plan = String(payload.plan || "Default").trim();
  if (!agentUrl || !domain) fail("agentUrl and domain required");
  const token = process.env.QADBAK_NODE_AGENT_TOKEN?.trim();
  if (!token) fail("QADBAK_NODE_AGENT_TOKEN not set");
  const res = await fetch(`${agentUrl}/v1/provision/domain`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ domain, user, plan }),
    signal: AbortSignal.timeout(300_000),
  });
  const body = await res.json();
  if (!res.ok || !body.ok) {
    fail(body.error ?? `Remote provision failed (${res.status})`);
  }
  emit({ ok: true, domain, result: body });
}
