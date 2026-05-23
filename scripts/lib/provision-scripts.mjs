import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
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
  phpmyadmin: "install-app-phpmyadmin.sh",
  nextcloud: "install-app-nextcloud.sh",
};

async function loadCatalog() {
  const p = path.join(QADBAK_DIR, "data", "script-catalog.json");
  try {
    const raw = await readFile(p, "utf8");
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return Object.keys(INSTALLERS).map((name) => ({
      name,
      desc: name,
      version: "native",
    }));
  }
}

export async function scriptAvailable(_domain) {
  const available = await loadCatalog();
  emit({ ok: true, available, source: "qadbak-script-catalog" });
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
  const sub = String(installPath || "public_html").replace(/^\//, "");
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
  emit({ ok: true, script: name, path: sub });
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
