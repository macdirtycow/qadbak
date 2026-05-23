/**
 * Native IMAP via Dovecot (doveadm) — no VirtualMin.
 * @see https://doc.dovecot.org/latest/core/man/doveadm.1.html
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { readFile, readdir, stat } from "node:fs/promises";
import { discoverMailLayout, listMailboxesFromLayout, resolveMailboxMaildir } from "./mail-layout.mjs";
import { fileExists } from "./provisioning-common.mjs";
import { doveadmAvailable } from "./doveadm-util.mjs";
import { bodyPreview, parseMailHeaders, splitHeadersAndBody } from "./mail-parse.mjs";

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

export function folderMaildirPath(maildirRoot, folder) {
  const f = String(folder || "INBOX").trim();
  if (!f || f === "INBOX" || f === ".") return maildirRoot;
  return path.join(maildirRoot, f);
}

async function statsForFolder(authUser, folder, maildirRoot) {
  let messages = "";
  let size = "";
  const statusAttempts = [
    ["-f", "tab", "mailbox", "status", "-u", authUser, "messages", "vsize", folder],
    ["mailbox", "status", "-u", authUser, "messages", "vsize", folder],
  ];
  for (const args of statusAttempts) {
    try {
      const { stdout } = await exec("doveadm", args, { timeout: 20_000 });
      const row = parseTabTable(stdout)[0] ?? {};
      if (row.messages !== undefined && row.messages !== "") {
        messages = row.messages;
        size = row.vsize ? formatBytes(row.vsize) : "";
        break;
      }
      const parts = stdout.trim().split(/\s+/);
      if (parts.length >= 2 && /^\d+$/.test(parts[0])) {
        messages = parts[0];
        size = formatBytes(parts[1]);
        break;
      }
    } catch {
      /* */
    }
  }
  if (maildirRoot) {
    const fp = folderMaildirPath(maildirRoot, folder);
    const n = await countMaildirMessages(fp);
    const mdCount = String(n);
    if (!messages || messages === "0") messages = mdCount;
    if (!size || size === "0 B") {
      const bytes = n > 0 ? await maildirFolderSize(fp) : 0;
      if (bytes > 0) size = formatBytes(bytes);
    }
  }
  return { messages, size };
}

/** List IMAP folders with message count and size (doveadm + Maildir enrichment). */
export async function listMailboxesDoveadm(authUser, maildirRoot = null) {
  const names = await listMailboxNames(authUser);
  const mailboxes = [];
  for (const folder of names) {
    const { messages, size } = await statsForFolder(authUser, folder, maildirRoot);
    mailboxes.push({ user: authUser, folder, messages, size });
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

export async function resolveMaildirRoot(layout, localPart, owner, home) {
  return resolveMailboxMaildir(layout, localPart, owner, home);
}

export async function listDomainMailUsers(layout) {
  const users = await listMailboxesFromLayout(layout);
  return users.map((u) => ({
    user: u.user,
    email: u.email ?? `${u.user}@${layout.domain}`,
    label: u.real ? `${u.user} (${u.real})` : u.user,
  }));
}

async function collectMaildirFiles(folderPath) {
  const files = [];
  for (const sub of ["cur", "new"]) {
    const dir = path.join(folderPath, sub);
    if (!(await fileExists(dir))) continue;
    for (const name of await readdir(dir)) {
      if (name.startsWith(".")) continue;
      const fp = path.join(dir, name);
      try {
        const st = await stat(fp);
        if (!st.isFile()) continue;
        files.push({ id: name, path: fp, mtime: st.mtimeMs, size: st.size });
      } catch {
        /* */
      }
    }
  }
  files.sort((a, b) => b.mtime - a.mtime);
  return files;
}

/** List messages in a folder (Maildir — reliable on Dovecot 2.3). */
export async function listMessagesMaildir(folderPath, limit = 80) {
  const files = await collectMaildirFiles(folderPath);
  const messages = [];
  for (const f of files.slice(0, limit)) {
    let headers = { subject: "", from: "", to: "", date: "" };
    try {
      const raw = await readFile(f.path, { encoding: "utf8" });
      headers = parseMailHeaders(raw);
    } catch {
      /* binary */
    }
    messages.push({
      id: f.id,
      subject: headers.subject || "(no subject)",
      from: headers.from,
      to: headers.to,
      date: headers.date,
      size: formatBytes(f.size),
    });
  }
  return messages;
}

/** Read one message from Maildir. */
export async function fetchMessageMaildir(folderPath, messageId) {
  const id = String(messageId || "").trim();
  if (!id || id.includes("/") || id.includes("..")) {
    throw new Error("Invalid message id");
  }
  for (const sub of ["cur", "new"]) {
    const fp = path.join(folderPath, sub, id);
    if (await fileExists(fp)) {
      const raw = await readFile(fp, "utf8");
      const { headers, body } = splitHeadersAndBody(raw);
      const h = parseMailHeaders(raw);
      return {
        id,
        subject: h.subject || "(no subject)",
        from: h.from,
        to: h.to,
        date: h.date,
        bodyText: bodyPreview(body),
        rawHeaders: headers.slice(0, 32_000),
        source: "maildir",
      };
    }
  }
  throw new Error("Message not found");
}

/** Try doveadm fetch for message list (optional). */
export async function listMessagesDoveadm(authUser, folder, limit = 80) {
  const box = String(folder || "INBOX").trim();
  const attempts = [
    ["fetch", "-u", authUser, "mailbox", box, "hdr.subject", "hdr.from", "hdr.to", "hdr.date"],
    ["-f", "tab", "fetch", "-u", authUser, "mailbox", box, "hdr.subject", "hdr.from", "hdr.to", "hdr.date"],
  ];
  for (const args of attempts) {
    try {
      const { stdout } = await exec("doveadm", args, {
        timeout: 120_000,
        maxBuffer: 8 * 1024 * 1024,
      });
      const parsed = parseDoveadmFetch(stdout);
      if (parsed.length) return parsed.slice(0, limit);
    } catch {
      /* */
    }
  }
  return [];
}

function parseDoveadmFetch(stdout) {
  const messages = [];
  let cur = {};
  const flush = () => {
    if (Object.keys(cur).length) {
      messages.push({
        id: String(cur.uid ?? cur["uid"] ?? messages.length + 1),
        subject: cur["hdr.subject"] ?? cur.subject ?? "(no subject)",
        from: cur["hdr.from"] ?? cur.from ?? "",
        to: cur["hdr.to"] ?? cur.to ?? "",
        date: cur["hdr.date"] ?? cur.date ?? "",
        size: "",
      });
      cur = {};
    }
  };
  for (const line of stdout.split("\n")) {
    const t = line.trim();
    if (!t) {
      flush();
      continue;
    }
    const m = t.match(/^([^\s:]+):\s*(.*)$/);
    if (m) {
      cur[m[1]] = m[2];
      continue;
    }
    const tab = t.split("\t");
    if (tab.length >= 2) {
      flush();
      cur.uid = tab[0];
      cur["hdr.subject"] = tab[1];
      cur["hdr.from"] = tab[2] ?? "";
      cur["hdr.date"] = tab[3] ?? "";
      flush();
    }
  }
  flush();
  return messages;
}

export async function fetchMessageDoveadm(authUser, folder, messageId) {
  const box = String(folder || "INBOX").trim();
  const uid = String(messageId || "").trim();
  const attempts = [
    ["fetch", "-u", authUser, "mailbox", box, "uid", uid, "body"],
    ["fetch", "-u", authUser, "mailbox", box, "uid", uid, "hdr.subject", "hdr.from", "body"],
  ];
  for (const args of attempts) {
    try {
      const { stdout } = await exec("doveadm", args, {
        timeout: 60_000,
        maxBuffer: 8 * 1024 * 1024,
      });
      const { headers, body } = splitHeadersAndBody(stdout);
      const h = parseMailHeaders(stdout);
      return {
        id: uid,
        subject: h.subject || "(no subject)",
        from: h.from,
        to: h.to,
        date: h.date,
        bodyText: bodyPreview(body || stdout),
        rawHeaders: headers.slice(0, 32_000),
        source: "doveadm",
      };
    } catch {
      /* */
    }
  }
  throw new Error("Message not found");
}

export async function listMessagesInFolder(authUser, maildirRoot, folder, limit = 80) {
  const fp = folderMaildirPath(maildirRoot, folder);
  let messages = await listMessagesMaildir(fp, limit);
  let source = "maildir";
  if (authUser && messages.length === 0) {
    const fromDove = await listMessagesDoveadm(authUser, folder, limit);
    if (fromDove.length) {
      messages = fromDove;
      source = "doveadm";
    }
  }
  return { messages, source, folderPath: fp };
}

export async function fetchMessageInFolder(authUser, maildirRoot, folder, messageId) {
  const fp = folderMaildirPath(maildirRoot, folder);
  try {
    return await fetchMessageMaildir(fp, messageId);
  } catch {
    if (authUser) return await fetchMessageDoveadm(authUser, folder, messageId);
    throw new Error("Message not found");
  }
}
