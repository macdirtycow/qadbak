import { access } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  emit,
  resolveDomainUser,
  loadRegistry,
  saveRegistry,
  fileExists,
} from "./provisioning-common.mjs";

const exec = promisify(execFile);

async function setRegistryDisabled(domain, disabled) {
  const d = String(domain).toLowerCase();
  const rows = await loadRegistry();
  const idx = rows.findIndex((r) => String(r.name).toLowerCase() === d);
  if (idx < 0) return;
  rows[idx].disabled = disabled;
  await saveRegistry(rows);
}

export async function domainEnable(domain) {
  const { user } = await resolveDomainUser(domain);
  await exec("usermod", ["-U", user], { timeout: 15_000 }).catch(() => {});
  const enabled = `/etc/nginx/sites-enabled/qadbak-customer-${domain}.conf`;
  const available = `/etc/nginx/sites-available/qadbak-customer-${domain}.conf`;
  await exec("ln", ["-sf", available, enabled], { timeout: 10_000 }).catch(() => {});
  try {
    await exec("nginx", ["-t"], { timeout: 15_000 });
    await exec("systemctl", ["reload", "nginx"], { timeout: 30_000 });
  } catch {
    /* */
  }
  await setRegistryDisabled(domain, false);
  emit({ ok: true, enabled: true });
}

export async function domainDisable(domain) {
  const { user } = await resolveDomainUser(domain);
  await exec("usermod", ["-L", user], { timeout: 15_000 }).catch(() => {});
  const enabled = `/etc/nginx/sites-enabled/qadbak-customer-${domain}.conf`;
  await exec("rm", ["-f", enabled], { timeout: 10_000 }).catch(() => {});
  try {
    await exec("systemctl", ["reload", "nginx"], { timeout: 30_000 });
  } catch {
    /* */
  }
  await setRegistryDisabled(domain, true);
  emit({ ok: true, enabled: false });
}

export async function domainValidate(domain) {
  const { user, home } = await resolveDomainUser(domain);
  const messages = [];
  let valid = true;
  try {
    await access(home);
    messages.push(`Home directory exists: ${home}`);
  } catch {
    valid = false;
    messages.push(`Missing home: ${home}`);
  }
  const pub = path.join(home, "public_html");
  if (await fileExists(pub)) {
    messages.push(`public_html present`);
  } else {
    messages.push(`public_html missing (optional)`);
  }
  const nginxSite = `/etc/nginx/sites-enabled/qadbak-customer-${domain}.conf`;
  if (await fileExists(nginxSite)) {
    messages.push(`Nginx vhost enabled`);
  } else if (await fileExists(`/etc/apache2/sites-enabled/${domain}.conf`)) {
    messages.push(`Apache vhost present`);
  }
  const rows = await loadRegistry();
  const hit = rows.find((r) => String(r.name).toLowerCase() === domain.toLowerCase());
  if (hit?.disabled) {
    messages.push(`Domain marked disabled in registry`);
  }
  emit({ ok: true, valid, messages });
}
