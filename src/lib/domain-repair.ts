import { access } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { runProvisioningHelper } from "./provisioner/native-exec";

const execFileAsync = promisify(execFile);

const REPAIR_SCRIPT =
  process.env.QADBAK_REPAIR_WEB_SCRIPT ??
  "/opt/qadbak/scripts/fix-domain-website.sh";

/** Sudoers grants NOPASSWD only for this script — not for `sudo true`. */
export async function repairAvailable(): Promise<boolean> {
  try {
    await access(REPAIR_SCRIPT);
    await execFileAsync("sudo", ["-n", REPAIR_SCRIPT, "__probe__"], {
      timeout: 10_000,
    });
    return true;
  } catch {
    /* fall back to provisioning helper */
  }
  try {
    await runProvisioningHelper("ping");
    return true;
  } catch {
    return false;
  }
}

export async function repairDomainWebsite(domain: string): Promise<string> {
  try {
    await access(REPAIR_SCRIPT);
    const { stdout, stderr } = await execFileAsync(
      "sudo",
      ["-n", REPAIR_SCRIPT, domain],
      { timeout: 300_000, maxBuffer: 8 * 1024 * 1024 },
    );
    return [stdout, stderr].filter(Boolean).join("\n").trim() || "Repair completed.";
  } catch {
    /* domain-repair sudo not configured — use provisioning helper (same as create) */
  }
  const result = await runProvisioningHelper("domain-website-repair", domain);
  const output = typeof result.output === "string" ? result.output : "";
  return output.trim() || "Repair completed.";
}
