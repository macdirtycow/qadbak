import { access } from "node:fs/promises";
import { domainToClientUsername } from "./domain-username";
import {
  applyClientPanelVhost,
  panelVhostAvailable,
  panelVhostHostname,
} from "./panel-vhost";
import {
  assignDomainToClient,
  createClientUser,
  findClientForDomain,
  findUserByUsername,
  setClientPassword,
} from "./users";

function panelVhostConfigPath(domain: string): string {
  const safe = domain.trim().toLowerCase().replace(/\./g, "-");
  return `/etc/nginx/sites-enabled/qadbak-panel-${safe}.conf`;
}

export async function getPanelClientStatus(domain: string) {
  const domainName = domain.trim().toLowerCase();
  const suggestedUsername = domainToClientUsername(domainName);
  const linked = await findClientForDomain(domainName);
  const byName = await findUserByUsername(suggestedUsername);
  const client = linked ?? (byName?.role === "client" ? byName : undefined);
  let vhostConfigured = false;
  try {
    await access(panelVhostConfigPath(domainName));
    vhostConfigured = true;
  } catch {
    /* */
  }
  const panelUrl = `http://${panelVhostHostname(domainName)}/login`;
  return {
    domain: domainName,
    suggestedUsername,
    client: client
      ? { username: client.username, domains: client.domains ?? [] }
      : null,
    panelUrl,
    vhostConfigured,
    panelVhostAvailable: await panelVhostAvailable(),
  };
}

export async function upsertPanelClient(opts: {
  domain: string;
  password: string;
  username?: string;
}): Promise<{ username: string; created: boolean }> {
  const domainName = opts.domain.trim().toLowerCase();
  const password = opts.password;
  if (!password || password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
  const username = domainToClientUsername(domainName, opts.username);
  const existing = await findUserByUsername(username);
  if (!existing) {
    await createClientUser({
      username,
      password,
      domains: [domainName],
    });
    return { username, created: true };
  }
  if (existing.role !== "client") {
    throw new Error(`Username ${username} is not a client account.`);
  }
  await setClientPassword(username, password);
  await assignDomainToClient(username, domainName);
  return { username, created: false };
}

export async function ensurePanelVhost(domain: string): Promise<string> {
  if (!(await panelVhostAvailable())) {
    throw new Error(
      "Panel vhost sudo not configured. Run: sudo bash scripts/configure-panel-vhost-sudo.sh",
    );
  }
  return applyClientPanelVhost(domain.trim().toLowerCase());
}
