import { premiumLibUnavailable } from "@/lib/premium/unavailable";

export function panelVhostHostname(domain: string): string {
  return `panel.${domain.trim().toLowerCase()}`;
}

export async function panelVhostAvailable(): Promise<boolean> {
  premiumLibUnavailable("panel-client-vhost");
}

export async function applyClientPanelVhost(_domain: string): Promise<string> {
  premiumLibUnavailable("panel-client-vhost");
}
