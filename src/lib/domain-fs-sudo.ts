import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { VirtualMinError } from "./errors";

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
  try {
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
  } catch (err) {
    const execErr = err as { message?: string; stdout?: string; stderr?: string };
    const stdout = String(execErr.stdout ?? "").trim();
    if (stdout) {
      const line = stdout.split("\n").pop() ?? "";
      try {
        const parsed = JSON.parse(line) as { error?: string };
        if (parsed.error) throw new VirtualMinError(parsed.error);
      } catch (parseErr) {
        if (parseErr instanceof VirtualMinError) throw parseErr;
      }
    }
    const stderr = String(execErr.stderr ?? "").trim();
    if (stderr) {
      const line = stderr.split("\n").filter(Boolean).pop() ?? stderr;
      throw new VirtualMinError(line);
    }
    const msg = execErr.message ?? String(err);
    if (/password is required|a password is required/i.test(msg)) {
      throw new VirtualMinError(
        "Native file access needs sudo. On the server run: sudo bash /opt/qadbak/scripts/configure-domain-fs-sudo.sh then pm2 restart qadbak.",
      );
    }
    throw err;
  }
}

/** Scale timeout for large uploads (cap 24h). */
export function uploadInstallTimeoutMs(fileBytes: number): number {
  const perMbMs = 2_000;
  const baseMs = 120_000;
  const scaled = baseMs + Math.ceil(fileBytes / (1024 * 1024)) * perMbMs;
  return Math.min(scaled, 86_400_000);
}

export async function runDomainFsInstallUpload(
  destAbs: string,
  tempPath: string,
  maxBytes: number | null,
  options?: { overwrite?: boolean; fileBytes?: number },
): Promise<{ sizeBytes: number }> {
  const unlimited = maxBytes === null;
  const timeoutBytes = options?.fileBytes ?? maxBytes ?? 100 * 1024 ** 3;
  const payload = JSON.stringify({
    tempPath,
    maxBytes: unlimited ? 0 : maxBytes,
    unlimited,
    overwrite: options?.overwrite !== false,
  });
  const stdout = await runDomainFsSudo(["install-upload", destAbs, payload], {
    timeout: uploadInstallTimeoutMs(timeoutBytes),
    maxBuffer: 1024 * 1024,
  });
  const line = stdout.trim().split("\n").pop() ?? "";
  const parsed = JSON.parse(line) as { ok?: boolean; sizeBytes?: number; error?: string };
  if (!parsed.ok) {
    throw new VirtualMinError(String(parsed.error ?? "Upload install failed."));
  }
  return { sizeBytes: Number(parsed.sizeBytes ?? 0) };
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
