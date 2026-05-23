/** Which native provisioning modules replace VirtualMin API (phase 8 sub-phases). */
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
