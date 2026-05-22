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

export async function runProvisioningHelper(
  ...args: string[]
): Promise<HelperResult> {
  const { stdout } = await execFileAsync(
    "sudo",
    ["-n", PROVISIONING_HELPER_WRAPPER, ...args],
    { timeout: 600_000, maxBuffer: 8 * 1024 * 1024 },
  );
  const line = stdout.trim().split("\n").filter(Boolean).pop() ?? "{}";
  const parsed = JSON.parse(line) as HelperResult;
  if (parsed.ok === false) {
    throw new Error(parsed.error ?? "Provisioning helper failed");
  }
  return parsed;
}
