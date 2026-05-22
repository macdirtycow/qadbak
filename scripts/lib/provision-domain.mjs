import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  emit,
  fail,
  loadRegistry,
  saveRegistry,
  QADBAK_DIR,
} from "./provisioning-common.mjs";

const exec = promisify(execFile);

function defaultUser(domain) {
  return (domain.split(".")[0] ?? "site").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32) || "site";
}

export async function domainCreate(domain, pass, userOpt) {
  const name = String(domain).trim().toLowerCase();
  const user = userOpt?.trim() || defaultUser(name);
  const home = `/home/${user}`;
  try {
    await exec("id", [user]);
  } catch {
    await exec("useradd", ["-m", "-s", "/bin/bash", user]);
  }
  await mkdir(path.join(home, "public_html"), { recursive: true });
  await mkdir(path.join(home, "backups"), { recursive: true });
  await writeFile(path.join(home, ".qadbak-domain"), `${name}\n`, "utf8");
  await exec("chown", ["-R", `${user}:${user}`, home]);
  const script = path.join(QADBAK_DIR, "scripts", "apply-customer-nginx-vhost-one.sh");
  await exec("bash", [script, name, user], { timeout: 120_000 });
  const rows = await loadRegistry();
  if (!rows.some((r) => r.name === name)) {
    rows.push({ name, user, disabled: false, plan: "Default", isDefault: rows.length === 0 });
    await saveRegistry(rows);
  }
  emit({ ok: true, domain: name, user, home });
}

export async function domainDelete(domain) {
  const name = String(domain).trim().toLowerCase();
  const rows = await loadRegistry();
  const hit = rows.find((r) => r.name === name);
  const user = hit?.user ?? defaultUser(name);
  const conf = `/etc/nginx/sites-enabled/qadbak-customer-${name}.conf`;
  await exec("rm", ["-f", conf, `/etc/nginx/sites-available/qadbak-customer-${name}.conf`]).catch(() => {});
  try {
    await exec("nginx", ["-t"]);
    await exec("systemctl", ["reload", "nginx"]);
  } catch {
    /* */
  }
  await saveRegistry(rows.filter((r) => r.name !== name));
  emit({ ok: true, domain: name, user, note: "Unix user not removed — delete manually if needed" });
}
