import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const DOMAIN_FS_SUDO_WRAPPER =
  process.env.QADBAK_DOMAIN_FS_WRAPPER ??
  "/opt/qadbak/scripts/run-domain-fs-helper.sh";

const USE_SUDO = process.env.QADBAK_DOMAIN_FS_SUDO !== "false";

export async function runDomainFsSudo(
  args: string[],
  options?: { timeout?: number; maxBuffer?: number },
): Promise<string> {
  const timeout = options?.timeout ?? 30_000;
  const maxBuffer = options?.maxBuffer ?? 8 * 1024 * 1024;
  if (USE_SUDO) {
    const { stdout } = await execFileAsync("sudo", ["-n", DOMAIN_FS_SUDO_WRAPPER, ...args], {
      timeout,
      maxBuffer,
    });
    return stdout;
  }
  const node = process.env.QADBAK_NODE_PATH ?? "node";
  const helper =
    process.env.QADBAK_DOMAIN_FS_HELPER ??
    "/opt/qadbak/scripts/domain-fs-helper.mjs";
  const { stdout } = await execFileAsync(node, [helper, ...args], { timeout, maxBuffer });
  return stdout;
}

export async function probeDomainFsSudo(): Promise<boolean> {
  try {
    const stdout = await runDomainFsSudo(["list", "/home"], { timeout: 10_000 });
    const line = stdout.trim().split("\n").pop() ?? "";
    const parsed = JSON.parse(line) as { ok?: boolean };
    return parsed.ok === true;
  } catch {
    return false;
  }
}
