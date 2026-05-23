import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { writeFile, access } from "node:fs/promises";
import {
  loadRegistry,
  QADBAK_DIR,
  fileExists,
} from "./provisioning-common.mjs";
import {
  appendMapEntry,
  ensureMaildir,
  postmapReload,
} from "./mail-layout.mjs";

const exec = promisify(execFile);

const VIRTUAL = "/etc/postfix/virtual";
const VIRTUAL_DOMAINS = "/etc/postfix/virtual_domains";

const MAIL_CONFIGURED_STAMP = "/var/lib/qadbak/native-mail-configured";
let stackConfigured = false;

export async function syncVirtualDomainsFile() {
  const rows = await loadRegistry();
  const domains = [
    ...new Set(
      rows
        .filter((r) => r.name && !r.disabled && r.type !== "alias")
        .map((r) => String(r.name).toLowerCase()),
    ),
  ].sort();
  await writeFile(
    VIRTUAL_DOMAINS,
    domains.length ? `${domains.join("\n")}\n` : "",
    "utf8",
  );
  return domains;
}

/** Ensure default Postfix entries + Maildir for a domain owner. */
export async function ensureDomainMailSetup(domain, owner) {
  const d = String(domain).trim().toLowerCase();
  const u = String(owner).trim();
  if (!d || !u) return;

  const home = `/home/${u}`;
  await ensureMaildir(path.join(home, "Maildir"));
  await appendMapEntry(VIRTUAL, `${u}@${d}`, u);
  await appendMapEntry(VIRTUAL, `postmaster@${d}`, u);
  await syncVirtualDomainsFile();
  await postmapReload(VIRTUAL);
}

export async function ensureNativeMailStack() {
  if (stackConfigured || (await fileExists(MAIL_CONFIGURED_STAMP))) {
    stackConfigured = true;
    return;
  }
  const script = path.join(QADBAK_DIR, "scripts", "configure-native-mail.sh");
  if (!(await fileExists(script))) return;
  try {
    await exec("bash", [script], { timeout: 180_000 });
    stackConfigured = true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Native mail stack setup failed: ${msg}`);
  }
}

export async function mailSyncAll() {
  await ensureNativeMailStack();
  const rows = await loadRegistry();
  for (const row of rows) {
    if (!row.name || row.disabled || row.type === "alias" || !row.user) continue;
    await ensureDomainMailSetup(row.name, row.user);
  }
  await syncVirtualDomainsFile();
  await postmapReload(VIRTUAL);
}

/** Quick health info for mail-diagnose. */
export async function mailDiagnose(domain) {
  const rows = await loadRegistry();
  const row = rows.find((r) => r.name === domain);
  const checks = [];

  async function ok(label, pass, detail = "") {
    checks.push({ label, ok: pass, detail });
  }

  try {
    const { stdout } = await exec("systemctl", ["is-active", "postfix"], { timeout: 5000 });
    await ok("postfix", stdout.trim() === "active", stdout.trim());
  } catch {
    await ok("postfix", false, "not active");
  }

  try {
    const { stdout } = await exec("systemctl", ["is-active", "dovecot"], { timeout: 5000 });
    await ok("dovecot", stdout.trim() === "active", stdout.trim());
  } catch {
    await ok("dovecot", false, "not active");
  }

  try {
    await access(VIRTUAL);
    await ok("postfix virtual map", true, VIRTUAL);
  } catch {
    await ok("postfix virtual map", false, "missing — run configure-native-mail.sh");
  }

  if (row?.user) {
    const md = path.join(`/home/${row.user}`, "Maildir");
    await ok("owner Maildir", await fileExists(md), md);
  }

  const domains = await syncVirtualDomainsFile();
  await ok(
    "virtual domains",
    domains.includes(String(domain).toLowerCase()),
    domains.join(", ") || "(none)",
  );

  return checks;
}
