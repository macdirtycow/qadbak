import path from "node:path";
import { readdir, stat } from "node:fs/promises";
import { emit, resolveDomainUser, fileExists } from "./provisioning-common.mjs";

async function listMaildirs(base) {
  const out = [];
  if (!(await fileExists(base))) return out;
  const entries = await readdir(base, { withFileTypes: true });
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const folder = path.join(base, ent.name);
    let messages = "";
    let size = "";
    try {
      const cur = path.join(folder, "cur");
      if (await fileExists(cur)) {
        const files = await readdir(cur);
        messages = String(files.length);
      }
      const st = await stat(folder);
      size = String(Math.round(st.size / 1024));
    } catch {
      /* */
    }
    out.push({
      user: "",
      folder: ent.name,
      messages,
      size: size ? `${size}K` : "",
    });
  }
  return out;
}

export async function imapList(domain, user) {
  const { user: owner, home } = await resolveDomainUser(domain);
  const mailUser = String(user || owner).trim();
  const bases = [
    path.join(home, "Maildir"),
    path.join(home, "homes", mailUser, "Maildir"),
    path.join(home, "mail", mailUser, "Maildir"),
  ];
  let mailboxes = [];
  for (const base of bases) {
    mailboxes = await listMaildirs(base);
    if (mailboxes.length) break;
  }
  if (!mailboxes.length) {
    mailboxes = [{ user: mailUser, folder: "INBOX", messages: "0", size: "" }];
  } else {
    mailboxes = mailboxes.map((m) => ({ ...m, user: mailUser }));
  }
  emit({ ok: true, mailboxes, source: "native-imap" });
}

export async function imapCopy(domain, from, to) {
  const { home } = await resolveDomainUser(domain);
  const src = path.join(home, from.replace(/^\//, ""));
  const dest = path.join(home, to.replace(/^\//, ""));
  const { cp } = await import("node:fs/promises");
  await cp(src, dest, { recursive: true, force: false });
  emit({ ok: true, from: src, to: dest });
}
