import fs from "node:fs";
import https from "node:https";
import { createHash } from "node:crypto";

export function legacyApiUrlIsLocal(urlString) {
  const url = urlString?.trim() || process.env.QADBAK_LEGACY_API_URL?.trim();
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return host === "127.0.0.1" || host === "localhost" || host === "::1";
  } catch {
    return false;
  }
}

export function legacyApiTlsInsecureEnabled() {
  const flag = process.env.QADBAK_LEGACY_API_TLS_INSECURE?.trim().toLowerCase();
  if (flag === "false" || flag === "0" || flag === "no") return false;
  if (flag === "true" || flag === "1" || flag === "yes") return true;
  return legacyApiUrlIsLocal();
}

export function resolveLegacyApiUrl(rawUrl) {
  if (!legacyApiTlsInsecureEnabled()) return rawUrl;
  let url;
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

export function legacyApiHttpsAgent() {
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
