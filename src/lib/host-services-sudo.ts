import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { BandwidthRow, ServerService } from "./virtualmin";

const execFileAsync = promisify(execFile);

export const HOST_SERVICES_SUDO_WRAPPER =
  process.env.QADBAK_HOST_SERVICES_WRAPPER ??
  "/opt/qadbak/scripts/run-host-services-helper.sh";

const USE_SUDO = process.env.QADBAK_HOST_SERVICES_SUDO !== "false";

type HelperResult = {
  ok?: boolean;
  services?: ServerService[];
  bandwidth?: BandwidthRow[];
  service?: string;
  status?: string;
  error?: string;
};

async function runHostServices(args: string[]): Promise<HelperResult> {
  let stdout: string;
  if (USE_SUDO) {
    ({ stdout } = await execFileAsync("sudo", ["-n", HOST_SERVICES_SUDO_WRAPPER, ...args], {
      timeout: 120_000,
      maxBuffer: 1024 * 1024,
    }));
  } else {
    const node = process.env.QADBAK_NODE_PATH ?? "node";
    const helper =
      process.env.QADBAK_HOST_SERVICES_HELPER ??
      "/opt/qadbak/scripts/host-services-helper.mjs";
    ({ stdout } = await execFileAsync(node, [helper, ...args], {
      timeout: 120_000,
      maxBuffer: 1024 * 1024,
    }));
  }
  const line = stdout.trim().split("\n").pop() ?? "{}";
  return JSON.parse(line) as HelperResult;
}

export async function probeHostServicesSudo(): Promise<boolean> {
  try {
    const r = await runHostServices(["list"]);
    return r.ok === true && Array.isArray(r.services);
  } catch {
    return false;
  }
}

export async function listNativeServerServices(): Promise<ServerService[]> {
  const r = await runHostServices(["list"]);
  if (!r.ok || !r.services) {
    throw new Error(r.error ?? "Host services helper failed.");
  }
  return r.services;
}

export async function controlNativeServerService(
  service: string,
  action: "start" | "stop" | "restart",
): Promise<void> {
  const r = await runHostServices([action, service]);
  if (!r.ok) throw new Error(r.error ?? `${action} failed for ${service}`);
}

export async function listNativeBandwidth(): Promise<BandwidthRow[]> {
  const r = await runHostServices(["bandwidth"]);
  if (!r.ok || !r.bandwidth) {
    throw new Error(r.error ?? "Host bandwidth helper failed.");
  }
  return r.bandwidth;
}
