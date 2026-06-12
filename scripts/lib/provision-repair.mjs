import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { emit, QADBAK_DIR } from "./provisioning-common.mjs";
import { jstep } from "./journal-emit.mjs";

const exec = promisify(execFile);

/** Full website repair (firewall, Apache backend, nginx, ensure public_html). */
export async function domainWebsiteRepair(domain) {
  const name = String(domain ?? "").trim().toLowerCase();
  if (!name) throw new Error("domain required");
  const script = path.join(QADBAK_DIR, "scripts", "fix-domain-website.sh");
  const t0 = Date.now();
  const { stdout, stderr } = await exec("bash", [script, name], {
    timeout: 300_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  const output = [stdout, stderr].filter(Boolean).join("\n");
  jstep("shell", `Website repair for ${name}`, {
    command: `fix-domain-website.sh ${name}`,
    durationMs: Date.now() - t0,
    output,
  });
  emit({ ok: true, domain: name, output });
}
