import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import {
  emit,
  fail,
  loadRegistry,
  saveRegistry,
  domainConfigDir,
  readDomainConfigJson,
  writeDomainConfigJson,
  QADBAK_DIR,
  nginxCustomerConfPaths,
} from "./provisioning-common.mjs";
import { ensureDomainMailSetup, ensureNativeMailStack } from "./mail-sync.mjs";
import { ensureBindZone } from "./provision-dns.mjs";

const exec = promisify(execFile);

function defaultUser(domain) {
  return (domain.split(".")[0] ?? "site")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 32) || "site";
}

function parseOpts(extraJson) {
  if (!extraJson) return {};
  try {
    const o = JSON.parse(extraJson);
    return typeof o === "object" && o ? o : {};
  } catch {
    return {};
  }
}

async function syncPhpFpmPool(user, domain) {
  const cfg = await readDomainConfigJson(domain, "php.json", {});
  const ver = cfg.defaultVersion || "8.2";
  const script = path.join(QADBAK_DIR, "scripts", "apply-php-fpm-pool.sh");
  await exec("bash", [script, user, ver, `/home/${user}`], { timeout: 120_000 }).catch(
    () => {},
  );
}

async function reloadNginx(domain, user) {
  const script = path.join(QADBAK_DIR, "scripts", "apply-domain-nginx.sh");
  await exec("bash", [script, domain, user], { timeout: 120_000 });
}

export async function domainCreate(domain, pass, userOpt, extraJson) {
  const name = String(domain).trim().toLowerCase();
  const opts = parseOpts(extraJson);
  const type = String(opts.type || "top").toLowerCase();
  const parent = String(opts.parent || "").trim().toLowerCase();
  const plan = String(opts.plan || "Default").trim() || "Default";

  const rows = await loadRegistry();
  if (rows.some((r) => r.name === name)) fail(`Domain already exists: ${name}`);

  let user = userOpt?.trim() || defaultUser(name);
  let parentUser = null;

  if (type === "sub" || type === "alias") {
    if (!parent) fail("parent domain required for sub/alias.");
    const prow = rows.find((r) => r.name === parent);
    if (!prow?.user) fail(`Unknown parent domain: ${parent}`);
    parentUser = prow.user;
    if (type === "alias") user = parentUser;
    else if (!userOpt?.trim()) user = parentUser;
  }

  const home = `/home/${user}`;
  const ownedByQadbak = type === "top" || (type === "sub" && user !== parentUser);

  if (ownedByQadbak) {
    try {
      await exec("id", [user]);
    } catch {
      await exec("useradd", ["-m", "-s", "/bin/bash", user]);
    }
    await mkdir(path.join(home, "public_html"), { recursive: true });
    await mkdir(path.join(home, "backups"), { recursive: true });
    await writeFile(path.join(home, ".qadbak-domain"), `${name}\n`, "utf8");
    await exec("chown", ["-R", `${user}:${user}`, home]);
  }

  if (ownedByQadbak) {
    await syncPhpFpmPool(user, name);
  }
  if (type === "alias" && parentUser) {
    await reloadNginx(name, parentUser);
  } else {
    await reloadNginx(name, user);
  }

  rows.push({
    name,
    user,
    disabled: false,
    plan,
    type,
    parent: parent || undefined,
    isDefault: rows.length === 0,
  });
  await saveRegistry(rows);

  if (type !== "alias") {
    await ensureBindZone(name);
  }

  if (ownedByQadbak && type !== "alias") {
    await writeDomainConfigJson(name, "php.json", {
      defaultVersion: "8.2",
      directories: [{ dir: "public_html", version: "8.2", mode: "fpm" }],
    });
  }

  if (type !== "alias") {
    await ensureNativeMailStack();
    await ensureDomainMailSetup(name, user);
  }

  emit({ ok: true, domain: name, user, home, type, parent: parent || null, plan });
}

export async function domainDelete(domain) {
  const name = String(domain).trim().toLowerCase();
  const rows = await loadRegistry();
  const hit = rows.find((r) => r.name === name);
  const user = hit?.user ?? defaultUser(name);

  const { available, enabled } = nginxCustomerConfPaths(name);
  await exec("rm", ["-f", enabled, available]).catch(() => {});
  const removePool = path.join(QADBAK_DIR, "scripts", "remove-php-fpm-pool.sh");
  await exec("bash", [removePool, user], { timeout: 60_000 }).catch(() => {});

  const cfgDir = domainConfigDir(name);
  await rm(cfgDir, { recursive: true, force: true }).catch(() => {});

  const marker = `/home/${user}/.qadbak-domain`;
  try {
    const { stdout } = await exec("cat", [marker]);
    if (stdout.trim() === name) {
      await exec("userdel", ["-r", user]).catch(() => {});
    }
  } catch {
    /* no marker — keep unix user */
  }

  try {
    await exec("nginx", ["-t"]);
    await exec("systemctl", ["reload", "nginx"]);
  } catch {
    /* */
  }

  await saveRegistry(rows.filter((r) => r.name !== name));
  emit({ ok: true, domain: name, user, removedUser: true });
}
