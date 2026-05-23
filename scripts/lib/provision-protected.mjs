import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import {
  emit,
  fail,
  resolveDomainUser,
  readDomainConfigJson,
  writeDomainConfigJson,
  fileExists,
} from "./provisioning-common.mjs";

export async function protectedList(domain) {
  const { home } = await resolveDomainUser(domain);
  const dirs = await readDomainConfigJson(domain, "protected.json", []);
  emit({
    ok: true,
    directories: dirs.map((d) => ({
      path: d.path,
      id: d.path,
    })),
    home,
    source: "qadbak-domain-config",
  });
}

export async function protectedCreate(domain, dirPath) {
  const { home } = await resolveDomainUser(domain);
  const rel = String(dirPath || "").trim().replace(/^\/+/, "");
  if (!rel) fail("Directory path required");
  const full = path.join(home, "public_html", rel);
  await mkdir(full, { recursive: true });
  const dirs = await readDomainConfigJson(domain, "protected.json", []);
  if (!dirs.some((d) => d.path === rel)) {
    dirs.push({ path: rel });
    await writeDomainConfigJson(domain, "protected.json", dirs);
  }
  const htaccess = path.join(full, ".htaccess");
  if (!(await fileExists(htaccess))) {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(
      htaccess,
      'AuthType Basic\nAuthName "Restricted"\nAuthUserFile .htpasswd\nRequire valid-user\n',
      "utf8",
    );
  }
  emit({ ok: true, path: rel });
}

export async function protectedDelete(domain, dirPath) {
  const rel = String(dirPath || "").trim().replace(/^\/+/, "");
  let dirs = await readDomainConfigJson(domain, "protected.json", []);
  dirs = dirs.filter((d) => d.path !== rel);
  await writeDomainConfigJson(domain, "protected.json", dirs);
  emit({ ok: true });
}

const exec = promisify(execFile);

function relDir(dirPath) {
  return String(dirPath || "").trim().replace(/^\/+/, "");
}

function htpasswdFile(home, rel) {
  return path.join(home, "public_html", rel, ".htpasswd");
}

async function parseHtpasswd(file) {
  try {
    const raw = await readFile(file, "utf8");
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => ({ user: line.split(":")[0] ?? "" }))
      .filter((u) => u.user);
  } catch {
    return [];
  }
}

export async function protectedUsersList(domain, dirPath) {
  const { home } = await resolveDomainUser(domain);
  const rel = relDir(dirPath);
  if (!rel) fail("Directory path required");
  const users = await parseHtpasswd(htpasswdFile(home, rel));
  emit({ ok: true, users, path: rel });
}

export async function protectedUserCreate(domain, dirPath, user, pass) {
  const { home, user: unixUser } = await resolveDomainUser(domain);
  const rel = relDir(dirPath);
  const name = String(user || "").trim();
  if (!rel || !name || !pass) fail("path, user, and password required");
  const file = htpasswdFile(home, rel);
  await mkdir(path.dirname(file), { recursive: true });
  try {
    await exec("htpasswd", ["-b", file, name, String(pass)], { timeout: 30_000 });
  } catch (e) {
    fail(
      `htpasswd failed (install apache2-utils): ${e instanceof Error ? e.message : e}`,
    );
  }
  await exec("chown", [`${unixUser}:${unixUser}`, file]).catch(() => {});
  emit({ ok: true, user: name, path: rel });
}

export async function protectedUserDelete(domain, dirPath, user) {
  const { home } = await resolveDomainUser(domain);
  const rel = relDir(dirPath);
  const name = String(user || "").trim();
  if (!rel || !name) fail("path and user required");
  const file = htpasswdFile(home, rel);
  try {
    await exec("htpasswd", ["-D", file, name], { timeout: 30_000 });
  } catch (e) {
    fail(e instanceof Error ? e.message : String(e));
  }
  emit({ ok: true, user: name });
}
