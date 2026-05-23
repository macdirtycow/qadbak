import { execFile } from "node:child_process";
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

function normPath(p) {
  let s = String(p || "").trim();
  if (!s.startsWith("/")) s = `/${s}`;
  return s.replace(/\/+$/, "") || "/";
}

async function applyNginx(domain, user) {
  const script = path.join(QADBAK_DIR, "scripts", "apply-domain-nginx.sh");
  await exec("bash", [script, domain, user], { timeout: 120_000 });
}

export async function proxyList(domain) {
  await resolveDomainUser(domain);
  const proxies = await readDomainConfigJson(domain, "proxies.json", []);
  emit({ ok: true, proxies, source: "qadbak-domain-config" });
}

export async function proxyCreate(domain, urlPath, dest, type) {
  const { user } = await resolveDomainUser(domain);
  const p = normPath(urlPath);
  const proxies = await readDomainConfigJson(domain, "proxies.json", []);
  if (proxies.some((r) => r.path === p)) fail(`Proxy exists: ${p}`);
  proxies.push({
    path: p,
    dest: String(dest || "").trim(),
    type: String(type || "proxy").trim() || "proxy",
  });
  await writeDomainConfigJson(domain, "proxies.json", proxies);
  await applyNginx(domain, user);
  emit({ ok: true, path: p });
}

export async function proxyDelete(domain, urlPath) {
  const { user } = await resolveDomainUser(domain);
  const p = normPath(urlPath);
  let proxies = await readDomainConfigJson(domain, "proxies.json", []);
  proxies = proxies.filter((r) => r.path !== p);
  await writeDomainConfigJson(domain, "proxies.json", proxies);
  await applyNginx(domain, user);
  emit({ ok: true });
}
