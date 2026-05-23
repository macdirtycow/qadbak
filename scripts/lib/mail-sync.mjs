import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  loadRegistry,
  QADBAK_DIR,
  fileExists,
  resolveDomainUser,
} from "./provisioning-common.mjs";
import {
  appendMapEntry,
  ensureMaildir,
  postmapReload,
  discoverMailLayout,
  listMailboxesFromLayout,
  writeVirtualMapFile,
} from "./mail-layout.mjs";
import { ensureInboundMailDns, mailDnsHints } from "./mail-dns.mjs";

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
  const { writeFile } = await import("node:fs/promises");
  await writeFile(
    VIRTUAL_DOMAINS,
    domains.length ? `${domains.join("\n")}\n` : "",
    "utf8",
  );
  return domains;
}

/** Rebuild /etc/postfix/virtual from all domains + mailboxes in native-domains.json. */
export async function rebuildVirtualAliasMap() {
  const rows = await loadRegistry();
  const entries = new Map();

  for (const row of rows) {
    if (!row.name || row.disabled || row.type === "alias" || !row.user) continue;
    const domain = String(row.name).toLowerCase();
    const owner = row.user;
    let home = `/home/${owner}`;
    try {
      const resolved = await resolveDomainUser(domain);
      home = resolved.home || home;
    } catch {
      /* use default home */
    }

    const layout = await discoverMailLayout(domain, owner, home);
    const mailboxes = await listMailboxesFromLayout(layout);

    entries.set(`postmaster@${domain}`, owner);
    for (const m of mailboxes) {
      const local = String(m.user || "").toLowerCase();
      if (!local) continue;
      const email = `${local}@${domain}`;
      const dest = local === owner ? owner : local;
      entries.set(email, dest);
    }
  }

  const sorted = [...entries.entries()].sort(([a], [b]) => a.localeCompare(b));
  await writeVirtualMapFile(
    VIRTUAL,
    sorted.map(([address, destination]) => ({ address, destination })),
  );
  return sorted.length;
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
  await ensureInboundMailDns(d).catch(() => {});
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
    const home = `/home/${row.user}`;
    await ensureMaildir(path.join(home, "Maildir"));
    try {
      const layout = await discoverMailLayout(row.name, row.user, home);
      const mailboxes = await listMailboxesFromLayout(layout);
      for (const m of mailboxes) {
        const local = m.user;
        const isOwner = local === row.user;
        const maildir = isOwner
          ? path.join(home, "Maildir")
          : path.join(layout.homesDir || path.join(home, "homes"), local, "Maildir");
        await ensureMaildir(maildir);
      }
    } catch {
      /* per-domain */
    }
  }

  await rebuildVirtualAliasMap();
  await syncVirtualDomainsFile();
  await postmapReload(VIRTUAL);

  for (const row of rows) {
    if (!row.name || row.disabled || row.type === "alias") continue;
    await ensureInboundMailDns(row.name).catch(() => {});
  }
}

/** Local delivery test: inject message via sendmail to mailbox@domain. */
export async function mailReceiveTest(domain, localUser) {
  const { user: owner, home } = await resolveDomainUser(domain);
  const local = String(localUser || owner).trim().toLowerCase();
  const layout = await discoverMailLayout(domain, owner, home);
  const mailboxes = await listMailboxesFromLayout(layout);
  if (!mailboxes.some((m) => m.user.toLowerCase() === local)) {
    throw new Error(`Unknown mailbox user: ${local}`);
  }

  const to = `${local}@${domain}`;
  const msg = [
    `To: ${to}`,
    `From: postmaster@${domain}`,
    "Subject: Qadbak inbound test",
    "",
    "Inbound mail delivery test.",
    "",
  ].join("\r\n");

  await exec("/usr/sbin/sendmail", ["-f", `postmaster@${domain}`, "-t", "-i"], {
    input: msg,
    timeout: 20_000,
  });

  const maildir =
    local === owner
      ? path.join(home, "Maildir", "new")
      : path.join(layout.homesDir || path.join(home, "homes"), local, "Maildir", "new");

  const { readdir } = await import("node:fs/promises");
  let count = 0;
  try {
    const files = await readdir(maildir);
    count = files.filter((f) => !f.startsWith(".")).length;
  } catch {
    count = 0;
  }

  return { to, maildir, newMessages: count };
}

/** Health info for mail-diagnose. */
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
    const { stdout } = await exec("ss", ["-tln"], { timeout: 5000 });
    await ok("smtp port 25", stdout.includes(":25 "), stdout.includes(":25 ") ? "listening" : "not listening");
  } catch {
    await ok("smtp port 25", false, "check failed");
  }

  try {
    await import("node:fs/promises").then((fs) => fs.access(VIRTUAL));
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

  const hints = await mailDnsHints(domain);
  await ok("dns hints", true, JSON.stringify(hints.records));

  return checks;
}

export { mailDnsHints, ensureInboundMailDns };
