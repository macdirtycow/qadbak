import { execFile } from "node:child_process";
import { readFile, appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import {
  emit,
  fail,
  resolveDomainUser,
  readDomainConfigJson,
  writeDomainConfigJson,
  fileExists,
  QADBAK_DIR,
} from "./provisioning-common.mjs";

const exec = promisify(execFile);

export async function stagingGet(domain) {
  const cfg = await readDomainConfigJson(domain, "staging.json", {
    enabled: false,
    subdomain: `staging.${domain}`,
    lastSync: null,
  });
  emit({ ok: true, config: cfg });
}

export async function stagingSync(domain) {
  const { home, user } = await resolveDomainUser(domain);
  const cfg = await readDomainConfigJson(domain, "staging.json", {
    subdomain: `staging.${domain}`,
  });
  const stagingDir = `${home}/staging`;
  const pub = `${home}/public_html`;
  await exec("mkdir", ["-p", stagingDir]);
  await exec(
    "sudo",
    [
      "-u",
      user,
      "bash",
      "-c",
      `rsync -a --delete ${pub}/ ${stagingDir}/public_html/ 2>/dev/null || cp -a ${pub}/. ${stagingDir}/public_html/`,
    ],
    { timeout: 300_000 },
  );
  cfg.enabled = true;
  cfg.lastSync = new Date().toISOString();
  await writeDomainConfigJson(domain, "staging.json", cfg);
  emit({ ok: true, config: cfg, stagingPath: `${stagingDir}/public_html` });
}

export async function bandwidthUsage(domain) {
  const { home } = await resolveDomainUser(domain);
  const limits = await readDomainConfigJson(domain, "limits.json", {});
  let bytes = 0;
  try {
    const { stdout } = await exec("du", ["-sb", home], { timeout: 60_000 });
    bytes = parseInt(stdout.split(/\s+/)[0] || "0", 10) || 0;
  } catch {
    /* */
  }
  const history = await readDomainConfigJson(domain, "bandwidth-history.json", { points: [] });
  const points = Array.isArray(history.points) ? history.points : [];
  points.push({ at: new Date().toISOString(), bytes });
  await writeDomainConfigJson(domain, "bandwidth-history.json", {
    points: points.slice(-90),
  });
  emit({
    ok: true,
    diskBytes: bytes,
    bandwidthLimitMb: limits.bandwidth ?? null,
    history: points.slice(-30),
  });
}

export async function redisGet(domain) {
  const cfg = await readDomainConfigJson(domain, "redis.json", {
    enabled: false,
    prefix: "",
    maxmemoryMb: 64,
  });
  if (!cfg.prefix) cfg.prefix = domain.replace(/\./g, "_");
  emit({ ok: true, config: cfg });
}

export async function redisSet(domain, payloadJson) {
  const payload = typeof payloadJson === "string" ? JSON.parse(payloadJson) : payloadJson;
  const cfg = {
    enabled: Boolean(payload.enabled),
    prefix: String(payload.prefix || domain.replace(/\./g, "_")),
    maxmemoryMb: parseInt(String(payload.maxmemoryMb || 64), 10) || 64,
  };
  await writeDomainConfigJson(domain, "redis.json", cfg);
  emit({ ok: true, config: cfg, note: "Use REDIS_PREFIX in your app; shared Redis on 127.0.0.1:6379" });
}

export async function sshKeysList(domain) {
  const { home, user } = await resolveDomainUser(domain);
  const auth = `${home}/.ssh/authorized_keys`;
  let keys = [];
  try {
    const text = await readFile(auth, "utf8");
    keys = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line, i) => ({
        id: String(i),
        preview: line.slice(0, 60) + (line.length > 60 ? "…" : ""),
        line,
      }));
  } catch {
    /* */
  }
  emit({ ok: true, user, keys });
}

export async function sshKeysAdd(domain, payloadJson) {
  const payload = typeof payloadJson === "string" ? JSON.parse(payloadJson) : payloadJson;
  const key = String(payload.publicKey || "").trim();
  if (!key.startsWith("ssh-")) fail("Valid SSH public key required");
  const { home, user } = await resolveDomainUser(domain);
  const sshDir = `${home}/.ssh`;
  const auth = `${sshDir}/authorized_keys`;
  await mkdir(sshDir, { recursive: true }).catch(() => {});
  await appendFile(auth, `${key}\n`);
  await exec("chown", ["-R", `${user}:${user}`, sshDir]).catch(() => {});
  await exec("chmod", ["700", sshDir]).catch(() => {});
  await exec("chmod", ["600", auth]).catch(() => {});
  emit({ ok: true });
}

export async function sshKeysDelete(domain, keyId) {
  const { home } = await resolveDomainUser(domain);
  const auth = `${home}/.ssh/authorized_keys`;
  const idx = parseInt(String(keyId), 10);
  let lines = [];
  try {
    const text = await readFile(auth, "utf8");
    lines = text.split("\n").filter((l) => l.trim());
  } catch {
    fail("No keys file");
  }
  if (idx < 0 || idx >= lines.length) fail("Key not found");
  lines.splice(idx, 1);
  const { writeFile } = await import("node:fs/promises");
  await writeFile(auth, lines.length ? `${lines.join("\n")}\n` : "", "utf8");
  emit({ ok: true });
}

export async function awstatsConfig(domain) {
  const { home } = await resolveDomainUser(domain);
  const cfg = await readDomainConfigJson(domain, "awstats.json", {
    enabled: false,
    configPath: `/etc/awstats/awstats.${domain}.conf`,
  });
  const conf = `LogFile="/var/log/nginx/access.log"
SiteDomain="${domain}"
HostAliases="${domain} www.${domain}"
DirData="${QADBAK_DIR}/data/domain-config/${domain}/awstats"
`;
  const dataDir = path.join(QADBAK_DIR, "data", "domain-config", domain, "awstats");
  await mkdir(dataDir, { recursive: true });
  if (cfg.enabled) {
    await writeDomainConfigJson(domain, "awstats.json", { ...cfg, snippet: conf });
  }
  emit({
    ok: true,
    config: cfg,
    dataDir,
    reportHint: `Install awstats and point to ${dataDir}`,
    logSource: home,
  });
}
