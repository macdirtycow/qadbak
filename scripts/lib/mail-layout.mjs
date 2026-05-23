import { readFile, access, readdir } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileExists } from "./provisioning-common.mjs";

const exec = promisify(execFile);

/** @typedef {{ domain: string, owner: string, home: string, aliasMap?: string, mailboxMap?: string, mailboxBase?: string, homesDir?: string, primaryMaildir?: string }} MailLayout */

export async function discoverMailLayout(domain, owner, home) {
  const layout = {
    domain,
    owner,
    home,
    homesDir: undefined,
    primaryMaildir: undefined,
    aliasMap: undefined,
    mailboxMap: undefined,
    mailboxBase: undefined,
  };

  if (await fileExists(path.join(home, "Maildir"))) {
    layout.primaryMaildir = path.join(home, "Maildir");
  }
  const homesDir = path.join(home, "homes");
  if (await fileExists(homesDir)) {
    layout.homesDir = homesDir;
  }

  try {
    const { stdout } = await exec(
      "postconf",
      ["-n", "virtual_alias_maps", "virtual_mailbox_maps", "virtual_mailbox_base"],
      { timeout: 15_000 },
    );
    for (const line of stdout.split("\n")) {
      const m = line.match(/^(\w+)\s*=\s*(.*)$/);
      if (!m) continue;
      const val = m[2].trim().replace(/^hash:|^regexp:|^static:/, "");
      if (m[1] === "virtual_alias_maps" && val && !val.startsWith("$")) {
        layout.aliasMap = val.split(",")[0].trim();
      }
      if (m[1] === "virtual_mailbox_maps" && val && !val.startsWith("$")) {
        layout.mailboxMap = val.split(",")[0].trim();
      }
      if (m[1] === "virtual_mailbox_base") layout.mailboxBase = val;
    }
  } catch {
    /* postconf unavailable */
  }

  for (const candidate of [
    layout.aliasMap,
    "/etc/postfix/virtual",
    "/etc/postfix/vmailbox",
  ]) {
    if (candidate && (await fileExists(candidate))) {
      layout.aliasMap = candidate;
      break;
    }
  }

  return layout;
}

/** Parse hash: map source file (pre-postmap). */
export async function readMapFile(mapPath) {
  if (!(await fileExists(mapPath))) return [];
  const text = await readFile(mapPath, "utf8");
  const rows = [];
  for (const raw of text.split("\n")) {
    const line = raw.split("#")[0].trim();
    if (!line) continue;
    const parts = line.split(/\s+/);
    if (parts.length < 2) continue;
    rows.push({ address: parts[0], destination: parts.slice(1).join(" ") });
  }
  return rows;
}

export async function listMailboxesFromLayout(layout) {
  const domain = layout.domain;
  const mailboxes = [];
  const seen = new Set();

  const add = (user, real) => {
    const key = user.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    mailboxes.push({
      user,
      name: user,
      real: real || user,
      email: `${user}@${domain}`,
    });
  };

  if (layout.primaryMaildir) {
    add(layout.owner, layout.owner);
  }

  if (layout.homesDir) {
    try {
      for (const name of await readdir(layout.homesDir)) {
        if (name.startsWith(".")) continue;
        const sub = path.join(layout.homesDir, name);
        try {
          await access(sub);
          add(name, name);
        } catch {
          /* */
        }
      }
    } catch {
      /* */
    }
  }

  if (layout.aliasMap) {
    const rows = await readMapFile(layout.aliasMap);
    for (const { address, destination } of rows) {
      const addr = address.toLowerCase();
      if (!addr.endsWith(`@${domain}`)) continue;
      const local = addr.split("@")[0];
      const dest = destination.split("@")[0].split(",")[0].trim();
      if (local && dest) add(local === dest ? local : dest, local);
    }
  }

  return mailboxes;
}

export async function writeVirtualMapFile(mapPath, rows) {
  const body = rows
    .map(({ address, destination }) => `${address}\t${destination}\n`)
    .join("");
  const { writeFile } = await import("node:fs/promises");
  await writeFile(mapPath, body, "utf8");
}

export async function appendMapEntry(mapPath, address, destination) {
  const rows = await readMapFile(mapPath);
  const needle = address.toLowerCase();
  const filtered = rows.filter((r) => r.address.toLowerCase() !== needle);
  filtered.push({ address, destination });
  const body = filtered.map((r) => `${r.address}\t${r.destination}\n`).join("");
  const { writeFile } = await import("node:fs/promises");
  await writeFile(mapPath, body, "utf8");
}

export async function removeMapEntry(mapPath, address) {
  const rows = await readMapFile(mapPath);
  const needle = address.toLowerCase();
  const filtered = rows.filter((r) => r.address.toLowerCase() !== needle);
  const { writeFile } = await import("node:fs/promises");
  await writeFile(
    mapPath,
    filtered.map((r) => `${r.address}\t${r.destination}\n`).join(""),
    "utf8",
  );
}

export async function postmapReload(mapPath) {
  await exec("postmap", [mapPath], { timeout: 30_000 });
  try {
    await exec("systemctl", ["reload", "postfix"], { timeout: 30_000 });
  } catch {
    await exec("postfix", ["reload"], { timeout: 30_000 }).catch(() => {});
  }
}

export async function ensureMaildir(dir) {
  for (const sub of ["cur", "new", "tmp"]) {
    const p = path.join(dir, sub);
    const { mkdir } = await import("node:fs/promises");
    await mkdir(p, { recursive: true });
  }
}
