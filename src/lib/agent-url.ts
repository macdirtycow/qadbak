const BLOCKED_HOSTS = new Set([
  "169.254.169.254",
  "metadata.google.internal",
  "metadata.google.internal.",
]);

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOSTS.has(host)) return true;
  if (host.endsWith(".internal")) return true;
  return false;
}

/** Validate panel-configured node agent URLs before fetch (SSRF guard). */
export function assertAllowedAgentUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid agent URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Agent URL must use http or https.");
  }
  if (url.username || url.password) {
    throw new Error("Agent URL must not include credentials.");
  }
  if (isBlockedHost(url.hostname)) {
    throw new Error("Agent URL host is not allowed.");
  }
  return `${url.origin}${url.pathname}`.replace(/\/$/, "");
}
