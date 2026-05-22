import fs from "node:fs/promises";
import path from "node:path";
import type { Role } from "../types";
import type { VirtualMinDomain } from "../types";

export type NativeDomainRecord = {
  name: string;
  user: string;
  disabled?: boolean;
  plan?: string;
};

const REGISTRY = path.join(process.cwd(), "data", "native-domains.json");

export async function loadNativeDomainRegistry(): Promise<NativeDomainRecord[]> {
  try {
    const raw = await fs.readFile(REGISTRY, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: NativeDomainRecord[] = [];
    for (const row of parsed) {
      const r = row as Record<string, unknown>;
      const name = String(r.name ?? "").trim();
      const user = String(r.user ?? name.split(".")[0] ?? "").trim();
      if (!name || !user) continue;
      out.push({
        name,
        user,
        disabled: Boolean(r.disabled),
        plan: String(r.plan ?? "Default"),
      });
    }
    return out;
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return [];
    throw e;
  }
}

/** Fallback when registry empty: unix users under /home with public_html. */
export async function scanHomeDomains(): Promise<NativeDomainRecord[]> {
  const home = "/home";
  let entries: string[] = [];
  try {
    entries = await fs.readdir(home);
  } catch {
    return [];
  }
  const out: NativeDomainRecord[] = [];
  for (const user of entries) {
    if (user === "." || user === ".." || user === "qadbak") continue;
    const pub = path.join(home, user, "public_html");
    try {
      const st = await fs.stat(pub);
      if (!st.isDirectory()) continue;
    } catch {
      continue;
    }
    const hint = path.join(home, user, ".qadbak-domain");
    let name = "";
    try {
      name = (await fs.readFile(hint, "utf8")).trim().split("\n")[0]?.trim() ?? "";
    } catch {
      /* no hint file */
    }
    if (!name.includes(".")) continue;
    out.push({ name, user, plan: "Default" });
  }
  return out;
}

export async function listDomainsNative(actor: {
  role: Role;
  domains: string[];
}): Promise<VirtualMinDomain[]> {
  let rows = await loadNativeDomainRegistry();
  if (rows.length === 0) rows = await scanHomeDomains();

  const mapped: VirtualMinDomain[] = rows.map((r) => ({
    name: r.name,
    disabled: r.disabled ? "1" : "0",
    plan: r.plan ?? "Default",
    user: r.user,
  }));

  if (actor.role === "client") {
    const allowed = new Set(actor.domains.map((d) => d.toLowerCase()));
    return mapped.filter((d) => allowed.has(d.name.toLowerCase()));
  }
  return mapped;
}

export async function findDomainByNameNative(
  domainName: string,
  actor: { role: Role; domains: string[] },
): Promise<VirtualMinDomain | undefined> {
  const want = domainName.trim().toLowerCase();
  const domains = await listDomainsNative(actor);
  return domains.find((d) => d.name.toLowerCase() === want);
}
