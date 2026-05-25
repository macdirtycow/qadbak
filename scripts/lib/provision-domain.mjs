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
import { jstep, jinfo } from "./journal-emit.mjs";

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

async function writeLandingPage(home, user, domain) {
  const script = path.join(QADBAK_DIR, "scripts", "lib", "qadbak-landing-html.sh");
  await exec(
    "bash",
    ["-c", `source "${script}" && write_qadbak_landing "${home}/public_html" "${domain}" "${user}:${user}"`],
    { timeout: 30_000 },
  ).catch(() => {});
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

  jinfo(`Resolved domain '${name}' (type=${type}, user=${user})`);

  if (ownedByQadbak) {
    let userExisted = false;
    try {
      await exec("id", [user]);
      userExisted = true;
    } catch {
      const t0 = Date.now();
      await exec("useradd", ["-m", "-s", "/bin/bash", user]);
      jstep("shell", `Created unix user '${user}'`, {
        command: `useradd -m -s /bin/bash ${user}`,
        durationMs: Date.now() - t0,
      });
    }
    if (userExisted) jinfo(`Unix user '${user}' already existed`);
    await mkdir(path.join(home, "public_html"), { recursive: true });
    await mkdir(path.join(home, "backups"), { recursive: true });
    jstep("file-write", `Created ${home}/public_html and ${home}/backups`, {
      filePath: home,
    });
    await writeFile(path.join(home, ".qadbak-domain"), `${name}\n`, "utf8");
    jstep("file-write", `Wrote ${home}/.qadbak-domain`, {
      filePath: `${home}/.qadbak-domain`,
      byteSize: name.length + 1,
    });
    await exec("chown", ["-R", `${user}:${user}`, home]);
    jstep("shell", `Took ownership of ${home}`, {
      command: `chown -R ${user}:${user} ${home}`,
    });
    await writeLandingPage(home, user, name);
    jinfo(`Wrote Qadbak landing page in ${home}/public_html`);
  }

  if (ownedByQadbak) {
    await syncPhpFpmPool(user, name);
    jstep("service-reload", `Applied PHP-FPM pool for '${user}'`, {
      command: `bash scripts/apply-php-fpm-pool.sh ${user} 8.2 ${home}`,
    });
  }
  if (type === "alias" && parentUser) {
    await reloadNginx(name, parentUser);
  } else {
    await reloadNginx(name, user);
  }
  jstep("service-reload", `Applied nginx vhost for ${name}`, {
    command: `bash scripts/apply-domain-nginx.sh ${name} ${user}`,
    filePath: `/etc/nginx/sites-available/qadbak-customer-${name.replace(/\./g, "_")}.conf`,
  });

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
  jstep("file-write", `Added '${name}' to native-domains.json registry`, {
    filePath: `${QADBAK_DIR}/data/native-domains.json`,
  });

  if (type !== "alias") {
    await ensureBindZone(name);
    jstep("service-reload", `Created BIND9 zone for ${name}`, {
      filePath: `/etc/bind/zones/db.${name}`,
    });
  }

  if (ownedByQadbak && type !== "alias") {
    await writeDomainConfigJson(name, "php.json", {
      defaultVersion: "8.2",
      directories: [{ dir: "public_html", version: "8.2", mode: "fpm" }],
    });
    jstep("file-write", `Wrote per-domain PHP config (8.2 + FPM)`, {
      filePath: `${QADBAK_DIR}/data/domain-config/${name}/php.json`,
    });
  }

  if (type !== "alias") {
    await ensureNativeMailStack();
    await ensureDomainMailSetup(name, user);
    jstep("service-reload", `Configured Postfix + Dovecot for ${name}`, {
      command: `mail-sync (Postfix virtual maps + Dovecot LDA for ${name})`,
    });
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
