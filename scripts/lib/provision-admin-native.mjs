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
  resolveDomainUser,
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

function isDnsPendingError(message) {
  const err = String(message ?? "").toLowerCase();
  return (
    err.includes("enotfound") ||
    err.includes("getaddrinfo") ||
    err.includes("could not resolve") ||
    err.includes("nxdomain") ||
    err.includes("name or service not known") ||
    err.includes("nodename nor servname")
  );
}

function apacheBackendBase() {
  const raw =
    process.env.QADBAK_APACHE_BACKEND?.trim() ||
    process.env.APACHE_BACKEND?.trim() ||
    "127.0.0.1:8080";
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw.replace(/\/+$/, "");
  }
  return `http://${raw.replace(/\/+$/, "")}`;
}

async function curlStatus(url, extraArgs = []) {
  const { stdout } = await exec(
    "curl",
    [
      "-sS",
      "--max-time",
      "10",
      "-o",
      "/dev/null",
      "-w",
      "%{http_code}",
      "-L",
      "--max-redirs",
      "3",
      ...extraArgs,
      url,
    ],
    { maxBuffer: 1024 * 1024 },
  );
  return Number.parseInt(String(stdout).trim(), 10) || 0;
}

async function probeWebsiteHealth(domain) {
  const localUrl = apacheBackendBase();
  let localOk = false;
  try {
    const status = await curlStatus(localUrl, ["-H", `Host: ${domain}`]);
    localOk = status >= 200 && status < 500;
  } catch {
    localOk = false;
  }

  let publicOk = null;
  let dnsPending = false;
  try {
    const status = await curlStatus(`https://${domain}`);
    publicOk = status >= 200 && status < 500;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    dnsPending = isDnsPendingError(msg);
    publicOk = false;
  }

  let websiteOk = null;
  if (localOk && (publicOk || dnsPending)) {
    websiteOk = true;
  } else if (!localOk) {
    websiteOk = false;
  } else if (localOk && !publicOk && !dnsPending) {
    websiteOk = false;
  }

  return { localOk, publicOk, dnsPending, websiteOk };
}

async function dockerStoppedApps(domain) {
  const stopped = [];
  try {
    const cfg = await readDomainConfigJson(domain, "runtimes.json", { apps: [] });
    const dockerApps = (cfg.apps || []).filter((a) => a.type === "docker");
    if (!dockerApps.length) return stopped;
    const { user, home } = await resolveDomainUser(domain);
    for (const app of dockerApps) {
      const appName = String(app.name || "stack");
      const compose =
        app.compose || path.join(home, "apps", appName, "docker-compose.yml");
      try {
        const { stdout } = await exec(
          "sudo",
          [
            "-u",
            user,
            "docker",
            "compose",
            "-f",
            compose,
            "ps",
            "-a",
            "--format",
            "{{.Service}}:{{.State}}",
          ],
          {
            cwd: path.dirname(compose),
            timeout: 60_000,
            maxBuffer: 256 * 1024,
          },
        );
        for (const line of stdout.split("\n")) {
          const idx = line.indexOf(":");
          if (idx < 0) continue;
          const svc = line.slice(0, idx).trim();
          const state = line.slice(idx + 1).trim().toLowerCase();
          if (!svc) continue;
          if (!state.includes("running")) {
            stopped.push(`${appName}/${svc}`);
          }
        }
      } catch {
        /* docker unavailable for this app */
      }
    }
  } catch {
    /* no runtimes config */
  }
  return [...new Set(stopped)];
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

    let website = {
      localOk: false,
      publicOk: null,
      dnsPending: false,
      websiteOk: null,
    };
    if (!disabled) {
      try {
        website = await probeWebsiteHealth(name);
      } catch {
        website = { localOk: false, publicOk: false, dnsPending: false, websiteOk: false };
      }
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
    if (!disabled && website.dnsPending) {
      actions.push({
        label: "DNS not live yet — site ready on server",
        href: `/domains/${encodeURIComponent(name)}/dns`,
        severity: "info",
      });
    } else if (!disabled && website.websiteOk === false) {
      actions.push({
        label: website.localOk
          ? "Public website unreachable"
          : "Website not responding on server",
        href: `/domains/${encodeURIComponent(name)}`,
        severity: website.localOk ? "warning" : "error",
      });
    }

    const containersStopped = disabled ? [] : await dockerStoppedApps(name);
    if (containersStopped.length) {
      actions.push({
        label: `Container stopped: ${containersStopped.join(", ")}`,
        href: `/domains/${encodeURIComponent(name)}`,
        severity: "error",
      });
    }

    items.push({
      domain: name,
      disabled,
      sslDaysLeft: sslDays,
      backupAgeDays: backupAge,
      diskUsedMb: diskUsed,
      diskLimitMb: diskLimit,
      websiteOk: disabled ? false : website.websiteOk,
      dnsPending: website.dnsPending,
      localWebsiteOk: website.localOk,
      mailOk: true,
      containersStopped,
      actions,
    });
  }
  emit({ ok: true, domains: items });
}

export async function systemNetworkSummary() {
  const interfaces = [];
  let defaultRoute = "";
  let primaryIpv4 = "";
  try {
    const { stdout } = await exec("ip", ["-j", "addr"], { maxBuffer: 2 * 1024 * 1024 });
    const parsed = JSON.parse(stdout);
    for (const iface of parsed) {
      if (!iface || iface.ifname === "lo") continue;
      const addrs = (iface.addr_info ?? [])
        .filter((a) => a.family === "inet" || a.family === "inet6")
        .map((a) => ({
          family: a.family,
          address: a.local,
          prefix: a.prefixlen,
          scope: a.scope,
        }));
      interfaces.push({
        name: iface.ifname,
        state: iface.operstate ?? "unknown",
        addresses: addrs,
      });
      for (const a of addrs) {
        if (a.family === "inet" && a.scope === "global" && !primaryIpv4) {
          primaryIpv4 = a.address;
        }
      }
    }
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e));
  }
  try {
    const { stdout } = await exec("ip", ["route", "show", "default"], { maxBuffer: 65536 });
    defaultRoute = stdout.trim().split("\n")[0] ?? "";
  } catch {
    defaultRoute = "";
  }
  emit({
    ok: true,
    interfaces,
    defaultRoute,
    primaryIpv4,
    originIp:
      process.env.QADBAK_ORIGIN_IP?.trim() ||
      process.env.QADBAK_SERVER_IP?.trim() ||
      primaryIpv4 ||
      "",
  });
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
