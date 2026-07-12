import path from "node:path";
import { mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  emit,
  fail,
  resolveDomainUser,
  readDomainConfigJson,
  writeDomainConfigJson,
} from "./provisioning-common.mjs";
import { chpasswdSafe } from "./chpasswd-safe.mjs";

const exec = promisify(execFile);

async function unixUserExists(name) {
  try {
    await exec("id", ["-u", name], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

export async function ftpList(domain) {
  const { user: owner } = await resolveDomainUser(domain);
  const stored = await readDomainConfigJson(domain, "ftp.json", []);
  const accounts = [...stored];
  try {
    const { stdout } = await exec(
      "getent",
      ["passwd"],
      { maxBuffer: 4 * 1024 * 1024 },
    );
    for (const line of stdout.split("\n")) {
      const parts = line.split(":");
      if (parts.length < 7) continue;
      const u = parts[0];
      const home = parts[5];
      if (home.startsWith(`/home/${owner}/ftp/`) || home.match(new RegExp(`^/home/${owner}/homes/[^/]+$`))) {
        if (!accounts.some((a) => a.user === u)) {
          accounts.push({ user: u, dir: home, quota: "" });
        }
      }
    }
  } catch {
    /* */
  }
  emit({ ok: true, accounts, source: "native-ftp" });
}

export async function ftpCreate(domain, localUser, pass) {
  const { user: owner, home } = await resolveDomainUser(domain);
  const local = String(localUser || "").trim().toLowerCase();
  if (!local) fail("FTP user name required");
  const ftpHome = path.join(home, "ftp", local);
  await mkdir(ftpHome, { recursive: true });
  if (!(await unixUserExists(local))) {
    await exec(
      "useradd",
      ["-m", "-d", ftpHome, "-s", "/usr/sbin/nologin", "-g", owner, local],
      { timeout: 30_000 },
    );
  }
  await exec("chown", ["-R", `${local}:${owner}`, ftpHome], { timeout: 60_000 });
  const accounts = await readDomainConfigJson(domain, "ftp.json", []);
  if (!accounts.some((a) => a.user === local)) {
    accounts.push({ user: local, dir: ftpHome, quota: "" });
    await writeDomainConfigJson(domain, "ftp.json", accounts);
  }
  if (pass) {
    await chpasswdSafe(local, pass);
  }
  emit({ ok: true, user: local, dir: ftpHome });
}

export async function ftpDelete(domain, localUser) {
  const { user: owner } = await resolveDomainUser(domain);
  const local = String(localUser || "").trim();
  let accounts = await readDomainConfigJson(domain, "ftp.json", []);
  accounts = accounts.filter((a) => a.user !== local);
  await writeDomainConfigJson(domain, "ftp.json", accounts);
  if (local !== owner && (await unixUserExists(local))) {
    await exec("userdel", ["-r", local], { timeout: 30_000 }).catch(() =>
      exec("userdel", [local]),
    );
  }
  emit({ ok: true });
}

export async function ftpPass(domain, localUser, pass) {
  const local = String(localUser || "").trim();
  if (!(await unixUserExists(local))) fail(`User ${local} not found`);
  await chpasswdSafe(local, pass);
  emit({ ok: true });
}
