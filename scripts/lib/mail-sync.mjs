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
  discoverMailLayout,
  listMailboxesFromLayout,
  writeVirtualMapFile,
  writeVirtualDomainsFile,
  postmapReloadAll,
  resolveMailboxMaildir,
  resolveUnixHome,
  QADBAK_POSTFIX_VIRTUAL,
  QADBAK_POSTFIX_DOMAINS,
} from "./mail-layout.mjs";
import { ensureInboundMailDns, mailDnsHints } from "./mail-dns.mjs";

const exec = promisify(execFile);

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
  await writeVirtualDomainsFile(domains);
  return domains;
}

/** Rebuild qadbak-virtual from all domains + mailboxes in native-domains.json. */
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
    QADBAK_POSTFIX_VIRTUAL,
    sorted.map(([address, destination]) => ({ address, destination })),
  );
  return sorted.length;
}

export async function ensureDomainMailSetup(domain, owner) {
  const d = String(domain).trim().toLowerCase();
  const u = String(owner).trim();
  if (!d || !u) return;

  const home = `/home/${u}`;
  await ensureMaildir(path.join(home, "Maildir"));
  await appendMapEntry(QADBAK_POSTFIX_VIRTUAL, `${u}@${d}`, u);
  await appendMapEntry(QADBAK_POSTFIX_VIRTUAL, `postmaster@${d}`, u);
  await syncVirtualDomainsFile();
  await postmapReloadAll();
  await ensureInboundMailDns(d).catch(() => {});
}

let stackConfiguring = false;

export async function ensureNativeMailStack() {
  if (stackConfigured || stackConfiguring || (await fileExists(MAIL_CONFIGURED_STAMP))) {
    stackConfigured = true;
    return;
  }
  const script = path.join(QADBAK_DIR, "scripts", "configure-native-mail.sh");
  if (!(await fileExists(script))) return;
  stackConfiguring = true;
  try {
    await exec("bash", [script, "--force"], { timeout: 180_000 });
    stackConfigured = true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Native mail stack setup failed: ${msg}`);
  } finally {
    stackConfiguring = false;
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
          : await resolveMailboxMaildir(layout, local, row.user, home);
        await ensureMaildir(maildir);
      }
    } catch {
      /* per-domain */
    }
  }

  await rebuildVirtualAliasMap();
  await syncVirtualDomainsFile();
  await postmapReloadAll();

  for (const row of rows) {
    if (!row.name || row.disabled || row.type === "alias") continue;
    await ensureInboundMailDns(row.name).catch(() => {});
  }
}

async function countNewMessages(maildirNew) {
  const { readdir } = await import("node:fs/promises");
  try {
    const files = await readdir(maildirNew);
    return files.filter((f) => !f.startsWith(".")).length;
  } catch {
    return 0;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function mailReceiveTest(domain, localUser) {
  const { user: owner, home } = await resolveDomainUser(domain);
  const local = String(localUser || owner).trim().toLowerCase();
  const layout = await discoverMailLayout(domain, owner, home);
  const mailboxes = await listMailboxesFromLayout(layout);
  if (!mailboxes.some((m) => m.user.toLowerCase() === local)) {
    throw new Error(`Unknown mailbox user: ${local}`);
  }

  const to = `${local}@${domain}`;
  const maildirRoot = await resolveMailboxMaildir(layout, local, owner, home);
  const maildirNew = path.join(maildirRoot, "new");

  const before = await countNewMessages(maildirNew);
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
    timeout: 30_000,
  });

  let after = before;
  for (let i = 0; i < 40; i += 1) {
    await sleep(250);
    after = await countNewMessages(maildirNew);
    if (after > before) break;
  }

  const delivered = after > before;
  return {
    to,
    maildir: maildirRoot,
    maildirNew,
    newMessages: Math.max(0, after - before),
    delivered,
  };
}

/** SMTP RCPT probe — verifies Postfix accepts mail for mailbox@domain. */
export async function smtpInboundProbe(domain, localUser) {
  const to = `${String(localUser).toLowerCase()}@${String(domain).toLowerCase()}`;
  const script = `
import socket, sys
to = sys.argv[1]
s = socket.create_connection(("127.0.0.1", 25), timeout=8)
def rd():
    return s.recv(4096).decode(errors="replace")
def wr(m):
    s.sendall((m + "\\r\\n").encode())
rd()
wr("HELO qadbak-probe")
rd()
wr("MAIL FROM:<probe@qadbak.local>")
rd()
wr("RCPT TO:<" + to + ">")
r = rd()
wr("QUIT")
print(r.strip())
sys.exit(0 if r.startswith("250") else 1)
`;
  try {
    const { stdout, stderr } = await exec("python3", ["-c", script, to], {
      timeout: 15_000,
    });
    const line = stdout.trim() || stderr.trim();
    const ok = line.startsWith("250");
    return { ok, response: line, recipient: to };
  } catch (e) {
    const err = e;
    const detail =
      err && typeof err === "object" && "stdout" in err
        ? String(err.stdout || err.stderr || "").trim()
        : e instanceof Error
          ? e.message
          : String(e);
    return { ok: false, response: detail || "SMTP probe failed", recipient: to };
  }
}

export async function mailDiagnose(domain, localUser) {
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
    await ok("smtp port 25", stdout.includes(":25 "), "listening");
  } catch {
    await ok("smtp port 25", false, "check failed");
  }

  try {
    const { stdout } = await exec("postconf", ["-n", "myhostname", "myorigin", "append_at_myorigin"], {
      timeout: 8000,
    });
    const hostLine = stdout.split("\n").find((l) => l.startsWith("myhostname"));
    const hostVal = hostLine?.split("=")[1]?.trim() || "";
    const ipHost = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostVal);
    await ok(
      "postfix myhostname (FQDN, not IP)",
      !ipHost && hostVal.includes("."),
      stdout.replace(/\n/g, " "),
    );
  } catch {
    await ok("postfix myhostname", false, "postconf failed");
  }

  try {
    const { stdout } = await exec("postconf", ["-n", "virtual_mailbox_domains", "mailbox_transport"], {
      timeout: 8000,
    });
    await ok(
      "postfix config",
      stdout.includes("qadbak-domains") && stdout.includes("dovecot-lmtp"),
      stdout.replace(/\n/g, " "),
    );
  } catch {
    await ok("postfix config", false, "postconf failed");
  }

  await ok("qadbak-virtual map", await fileExists(QADBAK_POSTFIX_VIRTUAL), QADBAK_POSTFIX_VIRTUAL);
  await ok("qadbak-domains map", await fileExists(QADBAK_POSTFIX_DOMAINS), QADBAK_POSTFIX_DOMAINS);

  const domains = await syncVirtualDomainsFile();
  await ok(
    "virtual domains",
    domains.includes(String(domain).toLowerCase()),
    domains.join(", ") || "(none)",
  );

  let probeUser = String(localUser || "").trim().toLowerCase();
  if (!probeUser) {
    try {
      const { user: owner, home } = await resolveDomainUser(domain);
      const layout = await discoverMailLayout(domain, owner, home);
      const mailboxes = await listMailboxesFromLayout(layout);
      const infoBox = mailboxes.find((m) => m.user.toLowerCase() === "info");
      probeUser = infoBox?.user || mailboxes[0]?.user || row?.user || "info";
    } catch {
      probeUser = row?.user || "info";
    }
  }
  const probe = await smtpInboundProbe(domain, probeUser);
  await ok(
    `SMTP RCPT TO ${probe.recipient}`,
    probe.ok,
    probe.response,
  );

  try {
    const delivery = await mailReceiveTest(domain, probeUser);
    await ok(
      `LMTP delivery → ${delivery.maildir}`,
      delivery.delivered,
      delivery.delivered
        ? `${delivery.newMessages} new message(s)`
        : "no message in Maildir/new after 10s — check journalctl -u postfix -u dovecot",
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await ok("LMTP delivery", false, msg);
  }

  const hints = await mailDnsHints(domain);
  await ok("dns hints", true, JSON.stringify(hints.records));

  return checks;
}

export { mailDnsHints, ensureInboundMailDns };
