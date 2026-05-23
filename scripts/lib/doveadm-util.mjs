/**
 * Dovecot / doveadm detection (works on Dovecot 2.3+; no --version flag).
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

export async function doveadmAvailable() {
  try {
    await exec("bash", ["-c", "command -v doveadm >/dev/null"], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/** Human-readable version for diagnostics. */
export async function doveadmVersionLine() {
  try {
    const { stdout } = await exec("doveadm", ["-V"], { timeout: 8000 });
    const line = stdout.trim().split("\n")[0];
    if (line) return line;
  } catch {
    /* */
  }
  try {
    const { stdout } = await exec("dovecot", ["--version"], { timeout: 8000 });
    return stdout.trim().split("\n")[0] || "dovecot";
  } catch {
    return "doveadm (version unknown)";
  }
}
