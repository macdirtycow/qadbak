/**
 * Native IMAP via Dovecot (doveadm) — no VirtualMin.
 * @see https://doc.dovecot.org/latest/core/man/doveadm.1.html
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { readdir, stat } from "node:fs/promises";
import { discoverMailLayout, listMailboxesFromLayout } from "./mail-layout.mjs";
import { fileExists } from "./provisioning-common.mjs";
import { doveadmAvailable } from "./doveadm-util.mjs";

export { doveadmAvailable };

const exec = promisify(execFile);

async function doveadmOk(args) {
  await exec("doveadm", args, {
    timeout: 30_000,
    maxBuffer: 4 * 1024 * 1024,
  });
}

function formatBytes(n) {
  const b = Number(n) || 0;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

/** Dovecot auth user candidates (email, unix, VirtualMin-style). */
export function authUserCandidates(domain, localPart, owner, layoutUsers = []) {
  const d = String(domain).toLowerCase();
  const local = String(localPart || "").trim().toLowerCase();
  const out = [];
  const add = (u) => {
    const v = String(u || "").trim();
    if (v && !out.includes(v)) out.push(v);
  };
  if (local) {
    add(`${local}@${d}`);
    add(local);
    add(`${local}+${d}`);
    add(`${local}.${d}`);
  } else {
    add(`${owner}@${d}`);
    add(owner);
  }
  for (const m of layoutUsers) {
    add(`${m.user}@${d}`);
    add(m.user);
  }
  return out;
}

export async function resolveDovecotAuthUser(candidates) {
  for (const user of candidates) {
    try {
      await doveadmOk(["mailbox", "list", "-u", user]);
      return user;
    } catch {
      try {
        await doveadmOk(["-f", "tab", "mailbox", "list", "-u", user]);
        return user;
      } catch {
        try {
          await doveadmOk(["user", user]);
          return user;
        } catch {
          /* try next candidate */
        }
      }
    }
  }
  return null;
}

function parseTabTable(stdout) {
  const lines = stdout.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0].split("\t");
  return lines.slice(1).map((line) => {
    const cols = line.split("\t");
    const row = {};
    header.forEach((h, i) => {
      row[h] = cols[i] ?? "";
    });
    return row;
  });
}

async function listMailboxNames(authUser) {
  try {
    const { stdout } = await exec(
      "doveadm",
      ["-f", "tab", "mailbox", "list", "-u", authUser],
      { timeout: 30_000, maxBuffer: 2 * 1024 * 1024 },
    );
    const names = stdout
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !/^mailbox$/i.test(l));
    if (names.length) return names;
  } catch {
    /* */
  }
  const { stdout: plain } = await exec(
    "doveadm",
    ["mailbox", "list", "-u", authUser],
    { timeout: 30_000, maxBuffer: 2 * 1024 * 1024 },
  );
  const names = plain
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return names.length ? names : ["INBOX"];
}

/** List IMAP folders with message count and size (doveadm). */
export async function listMailboxesDoveadm(authUser) {
  const names = await listMailboxNames(authUser);

  const mailboxes = [];
  try {
    const { stdout: statusOut } = await exec(
      "doveadm",
      [
        "-f",
        "tab",
        "mailbox",
        "status",
        "-u",
        authUser,
        "messages",
        "vsize",
        "ALL",
      ],
      { timeout: 60_000, maxBuffer: 4 * 1024 * 1024 },
    );
    const rows = parseTabTable(statusOut);
    const byName = new Map(rows.map((r) => [r.mailbox ?? r.Mailbox ?? "", r]));
    for (const folder of names) {
      const row = byName.get(folder) ?? {};
      mailboxes.push({
        user: authUser,
        folder,
        messages: row.messages ?? "",
        size: row.vsize ? formatBytes(row.vsize) : "",
      });
    }
  } catch {
    for (const folder of names) {
      let messages = "";
      let size = "";
      for (const args of [
        ["-f", "tab", "mailbox", "status", "-u", authUser, "messages", "vsize", folder],
        ["mailbox", "status", "-u", authUser, "messages", "vsize", folder],
      ]) {
        try {
          const { stdout } = await exec("doveadm", args, { timeout: 20_000 });
          const row = parseTabTable(stdout)[0] ?? {};
          if (row.messages !== undefined && row.messages !== "") {
            messages = row.messages;
            size = row.vsize ? formatBytes(row.vsize) : "";
            break;
          }
          const parts = stdout.trim().split(/\s+/);
          if (parts.length >= 2) {
            messages = parts[parts.length - 2] ?? "";
            size = formatBytes(parts[parts.length - 1]);
            break;
          }
        } catch {
          /* */
        }
      }
      mailboxes.push({ user: authUser, folder, messages, size });
    }
  }
  return mailboxes;
}

/** Copy messages between Dovecot mailboxes (same user). */
export async function copyMailboxDoveadm(authUser, fromBox, toBox) {
  const src = String(fromBox || "").trim();
  const dst = String(toBox || "").trim();
  if (!src || !dst) throw new Error("From and to mailbox names required (e.g. INBOX, Archive).");
  await exec(
    "doveadm",
    ["mailbox", "copy", "-u", authUser, src, dst],
    { timeout: 600_000, maxBuffer: 8 * 1024 * 1024 },
  );
}

async function countMaildirMessages(folderPath) {
  let n = 0;
  for (const sub of ["cur", "new"]) {
    const p = path.join(folderPath, sub);
    if (!(await fileExists(p))) continue;
    const files = await readdir(p);
    n += files.filter((f) => !f.startsWith(".")).length;
  }
  return n;
}

async function maildirFolderSize(folderPath) {
  let total = 0;
  async function walk(dir) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) await walk(p);
      else {
        try {
          const st = await stat(p);
          total += st.size;
        } catch {
          /* */
        }
      }
    }
  }
  await walk(folderPath);
  return total;
}

/** Maildir scan fallback when doveadm is unavailable. */
export async function listMailboxesMaildir(maildirRoot, authUser) {
  const mailboxes = [];
  if (!(await fileExists(maildirRoot))) {
    return [{ user: authUser, folder: "INBOX", messages: "0", size: "0 B" }];
  }
  const entries = await readdir(maildirRoot, { withFileTypes: true });
  const folders = [];
  const hasInboxShape =
    (await fileExists(path.join(maildirRoot, "cur"))) ||
    (await fileExists(path.join(maildirRoot, "new")));
  if (hasInboxShape) folders.push({ name: "INBOX", path: maildirRoot });
  for (const ent of entries) {
    if (!ent.isDirectory() || ent.name === "cur" || ent.name === "new" || ent.name === "tmp")
      continue;
    folders.push({ name: ent.name, path: path.join(maildirRoot, ent.name) });
  }
  for (const { name, path: folderPath } of folders) {
    const messages = String(await countMaildirMessages(folderPath));
    const size = formatBytes(await maildirFolderSize(folderPath));
    mailboxes.push({ user: authUser, folder: name, messages, size });
  }
  return mailboxes;
}

export function resolveMaildirRoot(layout, localPart, owner, home) {
  const local = String(localPart || owner).trim().toLowerCase();
  if (local === owner || !local) {
    return layout.primaryMaildir || path.join(home, "Maildir");
  }
  const homes = layout.homesDir || path.join(home, "homes");
  return path.join(homes, local, "Maildir");
}

export async function listDomainMailUsers(layout) {
  const users = await listMailboxesFromLayout(layout);
  return users.map((u) => ({
    user: u.user,
    email: u.email ?? `${u.user}@${layout.domain}`,
    label: u.real ? `${u.user} (${u.real})` : u.user,
  }));
}
