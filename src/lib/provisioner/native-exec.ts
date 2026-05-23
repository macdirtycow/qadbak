import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const PROVISIONING_HELPER_WRAPPER =
  process.env.QADBAK_PROVISIONING_WRAPPER ??
  "/opt/qadbak/scripts/run-provisioning-helper.sh";

export type HelperResult = {
  ok?: boolean;
  error?: string;
  [key: string]: unknown;
};

function parseHelperStdout(stdout: string): HelperResult | null {
  const lines = stdout.trim().split("\n").filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i].trim();
    if (!line.startsWith("{")) continue;
    try {
      return JSON.parse(line) as HelperResult;
    } catch {
      /* try previous line */
    }
  }
  return null;
}

export async function runProvisioningHelper(
  ...args: string[]
): Promise<HelperResult> {
  try {
    const { stdout } = await execFileAsync(
      "sudo",
      ["-n", PROVISIONING_HELPER_WRAPPER, ...args],
      { timeout: 600_000, maxBuffer: 8 * 1024 * 1024 },
    );
    const parsed = parseHelperStdout(stdout);
    if (!parsed) {
      throw new Error(
        `Provisioning helper returned non-JSON output: ${stdout.slice(0, 200).replace(/\s+/g, " ")}`,
      );
    }
    if (parsed.ok === false) {
      throw new Error(parsed.error ?? "Provisioning helper failed");
    }
    return parsed;
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    if (err.stdout) {
      const parsed = parseHelperStdout(err.stdout);
      if (parsed?.ok === false) {
        throw new Error(parsed.error ?? "Provisioning helper failed");
      }
    }
    if (err.message && !err.message.startsWith("Command failed:")) {
      throw e instanceof Error ? e : new Error(String(e));
    }
    const detail = err.stderr?.trim() || err.message || "Provisioning helper failed";
    throw new Error(detail);
  }
}
