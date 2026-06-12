/** Live demo panel at QADBAK_DEMO_HOST (default demo.qadbak.com). */

export function demoHost(): string {
  return process.env.QADBAK_DEMO_HOST?.trim().toLowerCase() || "demo.qadbak.com";
}

export function demoUsername(): string {
  return process.env.QADBAK_DEMO_USERNAME?.trim() || "demo";
}

export function demoShowcaseDomain(): string {
  return process.env.QADBAK_DEMO_SHOWCASE_DOMAIN?.trim().toLowerCase() || "showcase.qadbak.com";
}

export function demoReadOnlyEnabled(): boolean {
  const v = process.env.QADBAK_DEMO_READ_ONLY?.trim().toLowerCase();
  return v !== "false" && v !== "0";
}

export function isDemoHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const h = host.split(":")[0].trim().toLowerCase();
  return h === demoHost();
}

export function isDemoUser(username: string | null | undefined): boolean {
  if (!username) return false;
  return username.trim().toLowerCase() === demoUsername().toLowerCase();
}

export function demoPanelEnabled(): boolean {
  const v = process.env.QADBAK_DEMO_ENABLED?.trim().toLowerCase();
  return v === "true" || v === "1";
}
