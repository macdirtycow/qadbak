import { access } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const REPAIR_SCRIPT =
  process.env.QADBAK_REPAIR_WEB_SCRIPT ??
  "/opt/qadbak/scripts/fix-domain-website.sh";

export async function repairDomainWebsite(domain: string): Promise<string> {
  const { stdout, stderr } = await execFileAsync(
    "sudo",
    ["-n", "bash", REPAIR_SCRIPT, domain],
    { timeout: 120_000, maxBuffer: 2 * 1024 * 1024 },
  );
  return [stdout, stderr].filter(Boolean).join("\n").trim() || "Repair completed.";
}

export async function repairAvailable(): Promise<boolean> {
  try {
    await access(REPAIR_SCRIPT);
    await execFileAsync("sudo", ["-n", "true"], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}
