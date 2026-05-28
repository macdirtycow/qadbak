import { execFile } from "node:child_process";
import { readFile, access, mkdir, rm, stat } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";
import {
  emit,
  fail,
  resolveDomainUser,
  readDomainConfigJson,
  writeDomainConfigJson,
  domainConfigDir,
  QADBAK_DIR,
} from "./provisioning-common.mjs";

const exec = promisify(execFile);

const INSTALLERS = {
  wordpress: "install-app-wordpress.sh",
  joomla: "install-app-joomla.sh",
  drupal: "install-app-drupal.sh",
  phpmyadmin: "install-app-phpmyadmin.sh",
  nextcloud: "install-app-nextcloud.sh",
  matomo: "install-app-matomo.sh",
  prestashop: "install-app-prestashop.sh",
  ghost: "install-app-ghost.sh",
  mediawiki: "install-app-mediawiki.sh",
  moodle: "install-app-moodle.sh",
  phpbb: "install-app-phpbb.sh",
  opencart: "install-app-opencart.sh",
  kanboard: "install-app-kanboard.sh",
  limesurvey: "install-app-limesurvey.sh",
  grav: "install-app-grav.sh",
  adminer: "install-app-adminer.sh",
};

async function loadCatalog() {
  for (const file of ["app-catalog.json", "script-catalog.json"]) {
    const p = path.join(QADBAK_DIR, "data", file);
    try {
      const raw = await readFile(p, "utf8");
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) continue;
      return arr
        .filter((row) => !row.comingSoon)
        .map((row) => ({
        name: row.name ?? row.id,
        label: row.label ?? row.name,
        desc: row.desc ?? "",
        version: row.version ?? "native",
        minPhp: row.minPhp,
        requiresDb: Boolean(row.requiresDb),
        category: row.category,
        icon: row.icon,
        comingSoon: Boolean(row.comingSoon),
        intentMode: row.intentMode,
      }));
    } catch {
      /* try next */
    }
  }
  return Object.keys(INSTALLERS).map((name) => ({
    name,
    label: name,
    desc: name,
    version: "native",
  }));
}

async function assertSafeSubpath(home, sub, forceOverwrite) {
  const clean = String(sub || "public_html").replace(/^\//, "");
  if (clean.includes("..")) fail("Invalid install path");
  const full = path.join(home, clean);
  const index = path.join(full, "index.html");
  if (forceOverwrite === "true" || forceOverwrite === true || forceOverwrite === "1") {
    return clean;
  }
  try {
    await access(index);
    const { stdout } = await exec("head", ["-c", "2048", index], { maxBuffer: 8192 });
    const body = stdout.trim().toLowerCase();
    if (body.length > 1024 && !body.includes("hosted on qadbak") && !body.includes("hello")) {
      fail(
        "index.html looks like real site content — choose a subfolder or enable force overwrite",
      );
    }
  } catch {
    /* no index — ok */
  }
  return clean;
}

async function snapshotInstallDir(domain, home, sub, scriptName) {
  const target = path.join(home, sub);
  try {
    await access(target);
  } catch {
    return null;
  }
  const snapDir = path.join(domainConfigDir(domain), "script-snapshots");
  await mkdir(snapDir, { recursive: true });
  const id = `${scriptName}-${Date.now()}`;
  const archive = path.join(snapDir, `${id}.tar.gz`);
  await exec("tar", ["-czf", archive, "-C", home, sub], { timeout: 300_000 });
  return { id, archive };
}

export async function scriptAvailable(_domain) {
  const available = await loadCatalog();
  emit({ ok: true, available, source: "qadbak-app-catalog" });
}

export async function scriptList(domain) {
  await resolveDomainUser(domain);
  const installed = await readDomainConfigJson(domain, "scripts.json", []);
  emit({ ok: true, installed, source: "qadbak-domain-config" });
}

export async function scriptInstall(domain, scriptName, installPath, forceOverwrite) {
  const { user, home } = await resolveDomainUser(domain);
  const name = String(scriptName || "").trim().toLowerCase();
  const installer = INSTALLERS[name];
  if (!installer) fail(`Unknown script: ${name}`);
  const sub = await assertSafeSubpath(home, installPath, forceOverwrite);
  const snapshot = await snapshotInstallDir(domain, home, sub, name);
  const runner = path.join(QADBAK_DIR, "scripts", "lib", installer);
  try {
    await exec("sudo", ["-u", user, "bash", runner, home, sub], {
      timeout: 600_000,
      maxBuffer: 8 * 1024 * 1024,
    });
  } catch (e) {
    if (snapshot?.archive) {
      await scriptRollback(domain, name, snapshot.id).catch(() => {});
    }
    throw e;
  }
  const installed = await readDomainConfigJson(domain, "scripts.json", []);
  const row = {
    name,
    path: sub,
    installedAt: new Date().toISOString(),
    rollbackId: snapshot?.id ?? null,
    adminUrl:
      sub === "public_html" || sub === ""
        ? `https://${domain}/`
        : `https://${domain}/${sub.replace(/^public_html\/?/, "")}/`,
  };
  const idx = installed.findIndex((s) => s.name === name);
  if (idx >= 0) installed[idx] = row;
  else installed.push(row);
  await writeDomainConfigJson(domain, "scripts.json", installed);
  emit({
    ok: true,
    script: name,
    path: sub,
    rollbackId: snapshot?.id ?? null,
    adminUrl: row.adminUrl,
    postInstall: [
      `Verify SSL: https://${domain}/`,
      `Open site: ${row.adminUrl}`,
      "Complete CMS web installer (admin user + database)",
      "Remove install/upgrade directories when the CMS recommends it",
    ],
  });
}

export async function scriptRollback(domain, scriptName, rollbackId) {
  const { user, home } = await resolveDomainUser(domain);
  const name = String(scriptName || "").trim().toLowerCase();
  const installed = await readDomainConfigJson(domain, "scripts.json", []);
  const row = installed.find((s) => s.name === name);
  const id = rollbackId || row?.rollbackId;
  if (!id) fail("No rollback snapshot for this install");
  const archive = path.join(domainConfigDir(domain), "script-snapshots", `${id}.tar.gz`);
  try {
    await stat(archive);
  } catch {
    fail(`Snapshot not found: ${id}`);
  }
  const sub = row?.path || "public_html";
  const target = path.join(home, sub);
  await rm(target, { recursive: true, force: true }).catch(() => {});
  await mkdir(target, { recursive: true });
  await exec("tar", ["-xzf", archive, "-C", home], { timeout: 300_000 });
  await exec("chown", ["-R", `${user}:${user}`, target], { timeout: 120_000 });
  emit({ ok: true, rolledBack: name, rollbackId: id, path: sub });
}

export async function scriptRollbackCmd(domain, scriptName, rollbackId) {
  await scriptRollback(domain, scriptName, rollbackId);
}

export async function scriptDelete(domain, scriptName) {
  await resolveDomainUser(domain);
  const name = String(scriptName || "").trim().toLowerCase();
  let installed = await readDomainConfigJson(domain, "scripts.json", []);
  installed = installed.filter((s) => s.name !== name);
  await writeDomainConfigJson(domain, "scripts.json", installed);
  emit({
    ok: true,
    note: "Registry entry removed — delete app files under public_html manually if needed.",
  });
}
