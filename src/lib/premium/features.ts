/** Must stay in sync with the license-server feature catalog. */
export const ALL_PREMIUM_FEATURES = [
  "white-label",
  "client-rbac",
  "multi-tenant-clients",
  "panel-client-vhost",
  "admin-updates",
  "php-fpm-isolation",
  "dashboard-panel-control",
  "offsite-backup",
  "webmail-ui",
] as const;

export type PremiumFeatureId = (typeof ALL_PREMIUM_FEATURES)[number];
