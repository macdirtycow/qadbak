import { isIndependentMode } from "./native-stub";

/** Which native provisioning modules replace legacy hosting API API (phase 8 sub-phases). */
const ALL = [
  "ssl",
  "dns",
  "mail",
  "db",
  "domain",
  "backup",
  "cron",
  "aliases",
  "redirects",
  "features",
  "logs",
  "php",
  "ftp",
  "limits",
  "lifecycle",
  "mail-settings",
  "mail-logs",
  "imap",
  "protected",
  "shared",
  "proxies",
  "scripts",
  "runtimes",
  "security",
  "resellers",
] as const;

export type NativeFeature = (typeof ALL)[number];

export function nativeFeatureEnabled(feature: NativeFeature): boolean {
  const raw = process.env.QADBAK_NATIVE_FEATURES?.trim().toLowerCase() ?? "";
  if (!raw) return false;
  if (raw === "*" || raw === "all") return true;
  const set = new Set(
    raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean),
  );
  return set.has(feature);
}

export function listEnabledNativeFeatures(): NativeFeature[] {
  return ALL.filter((f) => nativeFeatureEnabled(f));
}

/** Panel mail uses Postfix/Dovecot on disk (not legacy hosting API remote.cgi). */
export function nativeMailUsesDirectBackend(): boolean {
  const mode = process.env.QADBAK_MAIL_BACKEND?.trim().toLowerCase() ?? "";
  if (mode === "direct" || mode === "postfix" || mode === "dovecot") {
    return true;
  }
  if (mode === "legacy-remote" || mode === "cli") return false;
  return isIndependentMode();
}

/** Dovecot IMAP/webmail — explicit imap flag, independent mode, or native direct mail. */
export function nativeImapEnabled(): boolean {
  return (
    nativeFeatureEnabled("imap") ||
    isIndependentMode() ||
    (nativeFeatureEnabled("mail") && nativeMailUsesDirectBackend())
  );
}

/** Mail delivery logs — explicit mail-logs flag or native mail module. */
export function nativeMailLogsEnabled(): boolean {
  return nativeFeatureEnabled("mail-logs") || nativeFeatureEnabled("mail");
}
