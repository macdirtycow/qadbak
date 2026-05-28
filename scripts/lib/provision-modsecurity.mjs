import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { emit, domainConfigDir } from "./provisioning-common.mjs";

const CFG = "modsecurity.json";

export async function modsecurityStatus(domain) {
  const cfgDir = domainConfigDir(domain);
  const cfgPath = path.join(cfgDir, CFG);
  let enabled = false;
  try {
    const raw = await readFile(cfgPath, "utf8");
    enabled = Boolean(JSON.parse(raw).enabled);
  } catch {
    enabled = false;
  }
  emit({ ok: true, domain, enabled, note: "Toggle writes domain config; reload nginx after package install." });
}

export async function modsecurityToggle(domain, flag) {
  const cfgDir = domainConfigDir(domain);
  await mkdir(cfgDir, { recursive: true });
  const enabled = flag === "true" || flag === "1" || flag === "on";
  await writeFile(
    path.join(cfgDir, CFG),
    `${JSON.stringify({ enabled, updatedAt: new Date().toISOString() }, null, 2)}\n`,
    "utf8",
  );
  emit({ ok: true, domain, enabled });
}
