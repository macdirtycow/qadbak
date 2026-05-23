import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { access } from "node:fs/promises";
import { emit, fail, resolveDomainUser } from "./provisioning-common.mjs";
import {
  discoverMailLayout,
  listMailboxesFromLayout,
  appendMapEntry,
  removeMapEntry,
  postmapReload,
  ensureMaildir,
} from "./mail-layout.mjs";
import { ensureNativeMailStack, syncVirtualDomainsFile } from "./mail-sync.mjs";
import { ensureInboundMailDns } from "./mail-dns.mjs";

const exec = promisify(execFile);

async function layoutForDomain(domain) {
  const { user, home } = await resolveDomainUser(domain);
  return discoverMailLayout(domain, user, home);
}

async function unixUserExists(name) {
  try {
    await exec("id", ["-u", name], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

export async function mailListDirect(domain) {
  const layout = await layoutForDomain(domain);
  const mailboxes = await listMailboxesFromLayout(layout);
  emit({ ok: true, mailboxes, source: "postfix-dovecot", layout: { aliasMap: layout.aliasMap } });
}

export async function mailCreateDirect(domain, localUser, pass, real) {
  await ensureNativeMailStack();
  const { user: owner, home } = await resolveDomainUser(domain);
  const layout = await discoverMailLayout(domain, owner, home);
  const local = String(localUser || "").trim().toLowerCase();
  if (!local || local.includes("@")) fail("Invalid mailbox user name");

  const email = `${local}@${domain}`;
  const isOwner = local === owner;

  if (isOwner) {
    const maildir = path.join(home, "Maildir");
    await ensureMaildir(maildir);
    await exec("chown", ["-R", `${owner}:${owner}`, maildir], { timeout: 60_000 });
  } else {
    const homesDir = layout.homesDir || path.join(home, "homes");
    const userHome = path.join(homesDir, local);
    const { mkdir } = await import("node:fs/promises");
    await mkdir(homesDir, { recursive: true });

    if (!(await unixUserExists(local))) {
      await exec(
        "useradd",
        [
          "-m",
          "-d",
          userHome,
          "-s",
          "/usr/sbin/nologin",
          "-g",
          owner,
          "-c",
          real || email,
          local,
        ],
        { timeout: 30_000 },
      );
    } else {
      await mkdir(userHome, { recursive: true });
    }
    await ensureMaildir(path.join(userHome, "Maildir"));
    await exec("chown", ["-R", `${local}:${owner}`, userHome], { timeout: 60_000 });
  }

  const mapPath = layout.aliasMap || "/etc/postfix/virtual";
  await appendMapEntry(mapPath, email, isOwner ? owner : local);
  await syncVirtualDomainsFile();
  await postmapReload(mapPath);
  await ensureInboundMailDns(domain).catch(() => {});

  if (pass) {
    const target = isOwner ? owner : local;
    const esc = pass.replace(/'/g, "'\\''");
    await exec("bash", ["-c", `echo '${target}:${esc}' | chpasswd`], {
      timeout: 15_000,
    });
  }

  emit({ ok: true, email, source: "postfix-dovecot" });
}

export async function mailDeleteDirect(domain, localUser) {
  const { user: owner, home } = await resolveDomainUser(domain);
  const layout = await discoverMailLayout(domain, owner, home);
  const local = String(localUser || "").trim().toLowerCase();
  const email = `${local}@${domain}`;

  const mapPath = layout.aliasMap || "/etc/postfix/virtual";
  await removeMapEntry(mapPath, email);
  await postmapReload(mapPath);

  if (local !== owner && (await unixUserExists(local))) {
    const userHome = path.join(layout.homesDir || path.join(home, "homes"), local);
    try {
      await exec("userdel", ["-r", local], { timeout: 30_000 });
    } catch {
      await exec("userdel", [local], { timeout: 30_000 }).catch(() => {});
      const { rm } = await import("node:fs/promises");
      await rm(userHome, { recursive: true, force: true }).catch(() => {});
    }
  }

  emit({ ok: true, source: "postfix-dovecot" });
}

export async function mailPassDirect(domain, localUser, pass) {
  const { user: owner } = await resolveDomainUser(domain);
  const local = String(localUser || "").trim().toLowerCase();
  const target = local === owner ? owner : local;
  if (!(await unixUserExists(target))) fail(`Unix user ${target} not found`);
  await exec("bash", ["-c", `echo '${target}:${pass.replace(/'/g, "'\\''")}' | chpasswd`], {
    timeout: 15_000,
  });
  emit({ ok: true, source: "postfix-dovecot" });
}
