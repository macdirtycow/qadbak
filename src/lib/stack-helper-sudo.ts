import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const STACK_HELPER_SUDO_WRAPPER =
  process.env.QADBAK_STACK_HELPER_WRAPPER ??
  "/opt/qadbak/scripts/run-stack-helper.sh";

export type StackCheck = {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
  output?: string;
};

export type StackValidateResult = {
  ok: boolean;
  checks: StackCheck[];
};

export type DomainStackValidateResult = {
  ok: boolean;
  domain: string;
  unixUser?: string;
  checks: StackCheck[];
};

type HelperPayload = {
  ok?: boolean;
  error?: string;
  checks?: StackCheck[];
  check?: StackCheck;
  domain?: string;
  unixUser?: string;
  output?: string;
  action?: string;
};

async function runStackHelper(args: string[]): Promise<HelperPayload> {
  const { stdout } = await execFileAsync("sudo", ["-n", STACK_HELPER_SUDO_WRAPPER, ...args], {
    timeout: 180_000,
    maxBuffer: 4 * 1024 * 1024,
  });
  const line = stdout.trim().split("\n").pop() ?? "{}";
  const parsed = JSON.parse(line) as HelperPayload;
  if (parsed.ok === false) {
    throw new Error(parsed.error ?? "Stack helper failed");
  }
  return parsed;
}

export async function probeStackHelperSudo(): Promise<boolean> {
  try {
    await runStackHelper(["ping"]);
    return true;
  } catch {
    return false;
  }
}

export async function validateStackConfig(): Promise<StackValidateResult> {
  const r = await runStackHelper(["validate"]);
  return { ok: r.ok ?? false, checks: r.checks ?? [] };
}

export async function validateDomainStackConfig(
  domain: string,
): Promise<DomainStackValidateResult> {
  const r = await runStackHelper(["domain-validate", domain]);
  return {
    ok: r.ok ?? false,
    domain: r.domain ?? domain,
    unixUser: r.unixUser,
    checks: r.checks ?? [],
  };
}

export async function runStackAction(
  action:
    | "nginx-reload"
    | "apache-reload"
    | "apply-nginx-vhosts"
    | "ufw-allow",
  options?: { port?: number },
): Promise<{ output?: string; action: string }> {
  const args =
    action === "ufw-allow"
      ? ["ufw-allow", String(options?.port ?? 0)]
      : [action];
  const r = await runStackHelper(args);
  return { action: r.action ?? action, output: r.output };
}
