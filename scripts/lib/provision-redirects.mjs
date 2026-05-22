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
  return s;
}

export async function redirectList(domain) {
  await resolveDomainUser(domain);
  const redirects = await readDomainConfigJson(domain, "redirects.json", []);
  emit({ ok: true, redirects, source: "qadbak-domain-config" });
}

async function applyNginx(domain, user) {
  const script = path.join(QADBAK_DIR, "scripts", "apply-domain-nginx.sh");
  await exec("bash", [script, domain, user], { timeout: 120_000 });
}

export async function redirectCreate(domain, urlPath, dest, type) {
  const { user } = await resolveDomainUser(domain);
  const p = normPath(urlPath);
  const redirects = await readDomainConfigJson(domain, "redirects.json", []);
  if (redirects.some((r) => r.path === p)) fail(`Redirect exists: ${p}`);
  redirects.push({
    path: p,
    dest: String(dest || "").trim(),
    type: String(type || "301").trim() || "301",
  });
  await writeDomainConfigJson(domain, "redirects.json", redirects);
  await applyNginx(domain, user);
  emit({ ok: true, path: p });
}

export async function redirectDelete(domain, urlPath) {
  const { user } = await resolveDomainUser(domain);
  const p = normPath(urlPath);
  let redirects = await readDomainConfigJson(domain, "redirects.json", []);
  redirects = redirects.filter((r) => r.path !== p);
  await writeDomainConfigJson(domain, "redirects.json", redirects);
  await applyNginx(domain, user);
  emit({ ok: true });
}
