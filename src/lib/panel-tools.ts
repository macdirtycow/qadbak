import { runProvisioningHelper } from "@/lib/provisioner/native-exec";
import {
  demoGlobalToolMock,
  demoSandboxActive,
} from "@/lib/demo-sandbox";

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

/** Scope global tools to demo showcase data — hide production domains on demo login. */
export async function runGlobalToolForSession(
  session: { username: string } | null | undefined,
  action: string,
  payload?: Record<string, unknown>,
) {
  if (session && demoSandboxActive(session.username)) {
    if (action === "system-awstats-summary" || action === "domain-health-batch") {
      return runGlobalTool(action, { ...payload, demoOnly: true });
    }
    return demoGlobalToolMock(action, payload);
  }
  if (action === "system-awstats-summary" || action === "domain-health-batch") {
    return runGlobalTool(action, { ...payload, excludeDemoOnly: true });
  }
  return runGlobalTool(action, payload);
}
