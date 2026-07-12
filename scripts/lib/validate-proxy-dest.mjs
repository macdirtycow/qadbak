/**
 * Validate reverse-proxy upstream URLs — block SSRF to localhost/private ranges.
 */

const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "[::1]",
  "metadata.google.internal",
  "169.254.169.254",
]);

function isPrivateIpv4(host) {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [, a, b] = m.map(Number);
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

/**
 * @param {string} dest
 */
export function validateProxyDest(dest) {
  const raw = String(dest || "").trim();
  if (!raw) {
    throw new Error("Proxy destination is required.");
  }
  if (/[\r\n\x00]/.test(raw)) {
    throw new Error("Invalid proxy destination.");
  }
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Proxy destination must be a valid http(s) URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Proxy destination must use http or https.");
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTS.has(host) || isPrivateIpv4(host)) {
    throw new Error(
      "Proxy destination cannot target localhost or private network addresses.",
    );
  }
  if (host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("Proxy destination cannot target internal hostnames.");
  }
  return raw;
}
