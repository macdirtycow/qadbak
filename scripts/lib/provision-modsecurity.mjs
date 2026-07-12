import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import {
  emit,
  domainConfigDir,
  resolveDomainUser,
  QADBAK_DIR,
} from "./provisioning-common.mjs";
import { assertDomainName } from "./security-utils.mjs";

const exec = promisify(execFile);
const CFG = "modsecurity.json";
const RULES = "modsecurity-nginx.conf";

const CRS_CANDIDATES = [
  "/etc/modsecurity/modsecurity.conf",
  "/usr/share/modsecurity-crs/crs-setup.conf",
  "/etc/nginx/modsecurity.conf",
];

export async function modsecurityStatus(domain) {
  const cfgDir = domainConfigDir(domain);
  const cfgPath = path.join(cfgDir, CFG);
  let enabled = false;
  let crsInstalled = false;
  try {
    const raw = await readFile(cfgPath, "utf8");
    enabled = Boolean(JSON.parse(raw).enabled);
  } catch {
    enabled = false;
  }
  for (const p of CRS_CANDIDATES) {
    try {
      await readFile(p);
      crsInstalled = true;
      break;
    } catch {
      /* next */
    }
  }
  emit({ ok: true, domain, enabled, crsInstalled });
}

async function writeModsecurityRulesFile(domain) {
  const cfgDir = domainConfigDir(domain);
  await mkdir(cfgDir, { recursive: true });
  const lines = [
    "# Qadbak ModSecurity + OWASP CRS (host paths)",
    "SecRuleEngine On",
  ];
  for (const inc of CRS_CANDIDATES) {
    try {
      await readFile(inc);
      lines.push(`Include ${inc}`);
    } catch {
      /* skip */
    }
  }
  lines.push(
    "",
    "# Per-domain audit log",
    `SecAuditEngine RelevantOnly`,
    `SecAuditLog ${path.join(cfgDir, "modsecurity-audit.log")}`,
    `SecAuditLogParts ABIJDEFHZ`,
  );
  await writeFile(path.join(cfgDir, RULES), `${lines.join("\n")}\n`, "utf8");
}

export async function modsecurityToggle(domain, flag) {
  const cfgDir = domainConfigDir(domain);
  await mkdir(cfgDir, { recursive: true });
  const enabled = flag === "true" || flag === "1" || flag === "on";
  await writeFile(
    path.join(cfgDir, CFG),
    `${JSON.stringify({ enabled, crs: true, updatedAt: new Date().toISOString() }, null, 2)}\n`,
    "utf8",
  );
  if (enabled) {
    await writeModsecurityRulesFile(domain);
  }
  try {
    const { user } = await resolveDomainUser(domain);
    await exec("bash", [path.join(QADBAK_DIR, "scripts", "apply-domain-nginx.sh"), domain, user], {
      timeout: 120_000,
    });
  } catch {
    /* best effort */
  }
  emit({ ok: true, domain, enabled, nginxReload: true });
}

export async function modsecurityLogs(domain, linesArg, grepArg) {
  const safeDomain = assertDomainName(domain);
  const n = Math.min(Number(linesArg) || 200, 2000);
  const grep = String(grepArg || safeDomain).trim();
  const cfgDir = domainConfigDir(domain);
  const candidates = [
    path.join(cfgDir, "modsecurity-audit.log"),
    "/var/log/nginx/modsec_audit.log",
    "/var/log/modsec_audit.log",
    "/var/log/apache2/modsec_audit.log",
  ];
  for (const logPath of candidates) {
    try {
      const raw = await readFile(logPath, "utf8");
      const filtered = grep
        ? raw.split("\n").filter((line) => line.includes(grep)).join("\n")
        : raw;
      const stdout = filtered
        .split("\n")
        .filter(Boolean)
        .slice(-n)
        .join("\n");
      const parsed = parseModsecAudit(stdout);
      emit({
        ok: true,
        domain,
        path: logPath,
        entries: parsed,
        rawLines: stdout.split("\n").filter(Boolean).slice(-n),
      });
      return;
    } catch {
      /* try next */
    }
  }
  emit({
    ok: true,
    domain,
    entries: [],
    note: "No ModSecurity audit log. Enable WAF and install libnginx-mod-security + CRS.",
  });
}

function parseModsecAudit(raw) {
  const entries = [];
  const blocks = raw.split(/(?:\n)(?=---[a-z0-9]+---)/i);
  for (const block of blocks.slice(-80)) {
    const id = block.match(/id "(\d+)"/)?.[1];
    const msg = block.match(/msg "([^"]+)"/)?.[1];
    const uri = block.match(/uri "([^"]+)"/)?.[1];
    const severity = block.match(/severity "([^"]+)"/)?.[1];
    if (id || msg) {
      entries.push({ id, msg, uri, severity, preview: block.slice(0, 400) });
    }
  }
  if (!entries.length && raw.trim()) {
    entries.push({ preview: raw.slice(-2000) });
  }
  return entries;
}

export async function modsecurityCrsCheck() {
  const found = [];
  for (const p of CRS_CANDIDATES) {
    try {
      await readFile(p);
      found.push(p);
    } catch {
      /* skip */
    }
  }
  emit({ ok: true, installed: found.length > 0, includes: found });
}
