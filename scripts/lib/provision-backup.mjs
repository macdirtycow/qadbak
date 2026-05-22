import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readdir, stat, mkdir } from "node:fs/promises";
import path from "node:path";
import { emit, resolveDomainUser } from "./provisioning-common.mjs";

const exec = promisify(execFile);

export async function backupList(domain) {
  const { home } = await resolveDomainUser(domain);
  const dir = path.join(home, "backups");
  await mkdir(dir, { recursive: true });
  const files = [];
  try {
    for (const name of await readdir(dir)) {
      if (!name.endsWith(".tar.gz")) continue;
      const full = path.join(dir, name);
      const st = await stat(full);
      files.push({
        name,
        sizeBytes: st.size,
        modified: st.mtime.toISOString().slice(0, 10),
      });
    }
  } catch {
    /* empty */
  }
  emit({ ok: true, backups: files });
}

export async function backupCreate(domain) {
  const { user, home } = await resolveDomainUser(domain);
  const dir = path.join(home, "backups");
  await mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const file = path.join(dir, `${domain}-${stamp}.tar.gz`);
  await exec(
    "tar",
    ["-czf", file, "-C", home, "public_html"],
    { timeout: 600_000, maxBuffer: 8 * 1024 * 1024 },
  );
  await exec("chown", [`${user}:${user}`, file]);
  emit({ ok: true, file: path.basename(file) });
}
