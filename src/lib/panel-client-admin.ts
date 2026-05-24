import { premiumLibUnavailable } from "@/lib/premium/unavailable";

export async function getPanelClientStatus(_domain: string) {
  premiumLibUnavailable("panel-client-vhost");
}

export async function upsertPanelClient(_opts: {
  domain: string;
  password: string;
  username?: string;
}): Promise<{ username: string; created: boolean }> {
  premiumLibUnavailable("panel-client-vhost");
}

export async function ensurePanelVhost(_domain: string): Promise<string> {
  premiumLibUnavailable("panel-client-vhost");
}
