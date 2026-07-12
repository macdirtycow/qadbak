import fs from "node:fs";
import https from "node:https";
import { createHash } from "node:crypto";

export function legacyApiUrlIsLocal(urlString?: string): boolean {
  const url = urlString?.trim() || process.env.QADBAK_LEGACY_API_URL?.trim();
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return host === "127.0.0.1" || host === "localhost" || host === "::1";
  } catch {
    return false;
  }
}

/**
 * When true, localhost legacy API may use HTTP or pinned TLS instead of global cert disable.
 * Auto-enabled for QADBAK_LEGACY_API_URL on 127.0.0.1/localhost unless QADBAK_LEGACY_API_TLS_INSECURE=false.
 */
export function legacyApiTlsInsecureEnabled(): boolean {
  const flag = process.env.QADBAK_LEGACY_API_TLS_INSECURE?.trim().toLowerCase();
  if (flag === "false" || flag === "0" || flag === "no") return false;
  if (flag === "true" || flag === "1" || flag === "yes") return true;
  return legacyApiUrlIsLocal();
}

/** Prefer HTTP for localhost self-signed setups; keep HTTPS when CA or fingerprint is configured. */
export function resolveLegacyApiUrl(rawUrl: string): string {
  if (!legacyApiTlsInsecureEnabled()) return rawUrl;
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return rawUrl;
  }
  if (!legacyApiUrlIsLocal(url.href)) return rawUrl;
  const hasCa = Boolean(process.env.QADBAK_LEGACY_API_CA_FILE?.trim());
  const hasFingerprint = Boolean(process.env.QADBAK_LEGACY_API_TLS_FINGERPRINT?.trim());
  if (url.protocol === "https:" && !hasCa && !hasFingerprint) {
    url.protocol = "http:";
  }
  return url.href;
}

/** Optional strict/pinned HTTPS agent — never disables certificate validation globally. */
export function legacyApiHttpsAgent(): https.Agent | undefined {
  const caFile = process.env.QADBAK_LEGACY_API_CA_FILE?.trim();
  if (caFile) {
    return new https.Agent({ ca: fs.readFileSync(caFile) });
  }
  const fpRaw = process.env.QADBAK_LEGACY_API_TLS_FINGERPRINT?.trim();
  if (!fpRaw) return undefined;
  const fingerprint = fpRaw.replace(/:/g, "").toLowerCase();
  return new https.Agent({
    checkServerIdentity(_host, cert) {
      const hash = createHash("sha256").update(cert.raw).digest("hex");
      if (hash !== fingerprint) {
        throw new Error("Legacy API certificate fingerprint mismatch.");
      }
      return undefined;
    },
  });
}
