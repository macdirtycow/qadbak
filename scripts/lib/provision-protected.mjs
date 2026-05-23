import path from "node:path";
import { mkdir } from "node:fs/promises";
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
