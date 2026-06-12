import { runProvisioningHelper } from "@/lib/provisioner/native-exec";

/** Domain-scoped panel tool → provisioning-helper command. */
export async function runDomainTool(
  domain: string,
  action: string,
  payload?: Record<string, unknown>,
) {
  const args = payload ? [domain, JSON.stringify(payload)] : [domain];
  return runProvisioningHelper(action, ...args);
}

export async function runGlobalTool(action: string, payload?: Record<string, unknown>) {
  const args = payload ? [JSON.stringify(payload)] : [];
  return runProvisioningHelper(action, ...args);
}
