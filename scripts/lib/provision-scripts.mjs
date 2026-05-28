import { execFile } from "node:child_process";
import { readFile, access } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";
import {
  emit,
  fail,
  resolveDomainUser,
  readDomainConfigJson,
  writeDomainConfigJson,
  QADBAK_DIR,
} from "./provisioning-common.mjs";

const exec = promisify(execFile);

const INSTALLERS = {
  wordpress: "install-app-wordpress.sh",
  joomla: "install-app-joomla.sh",
  drupal: "install-app-drupal.sh",
  phpmyadmin: "install-app-phpmyadmin.sh",
  nextcloud: "install-app-nextcloud.sh",
};

async function loadCatalog() {
  for (const file of ["app-catalog.json", "script-catalog.json"]) {
    const p = path.join(QADBAK_DIR, "data", file);
    try {
      const raw = await readFile(p, "utf8");
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) continue;
      return arr.map((row) => ({
        name: row.name ?? row.id,
        label: row.label ?? row.name,
        desc: row.desc ?? "",
        version: row.version ?? "native",
        minPhp: row.minPhp,
        requiresDb: Boolean(row.requiresDb),
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

async function assertSafeSubpath(home, sub) {
  const clean = String(sub || "public_html").replace(/^\//, "");
  if (clean.includes("..")) fail("Invalid install path");
  const full = path.join(home, clean);
  const index = path.join(full, "index.html");
  try {
    await access(index);
    const { stdout } = await exec("head", ["-c", "2048", index], { maxBuffer: 8192 });
    const body = stdout.trim().toLowerCase();
    if (body.length > 1024 && !body.includes("hosted on qadbak") && !body.includes("hello")) {
      fail(
        "index.html looks like real site content — choose a subfolder or confirm overwrite in panel",
      );
    }
  } catch {
    /* no index — ok */
  }
  return clean;
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

export async function scriptInstall(domain, scriptName, installPath) {
  const { user, home } = await resolveDomainUser(domain);
  const name = String(scriptName || "").trim().toLowerCase();
  const installer = INSTALLERS[name];
  if (!installer) fail(`Unknown script: ${name}`);
  const sub = await assertSafeSubpath(home, installPath);
  const runner = path.join(QADBAK_DIR, "scripts", "lib", installer);
  await exec("sudo", ["-u", user, "bash", runner, home, sub], {
    timeout: 600_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  const installed = await readDomainConfigJson(domain, "scripts.json", []);
  if (!installed.some((s) => s.name === name)) {
    installed.push({
      name,
      path: sub,
      installedAt: new Date().toISOString(),
    });
    await writeDomainConfigJson(domain, "scripts.json", installed);
  }
  emit({
    ok: true,
    script: name,
    path: sub,
    postInstall: [
      "Issue or verify SSL for the site hostname",
      "Complete CMS web installer if applicable",
      "Remove install wizard directories when the app recommends it",
    ],
  });
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
