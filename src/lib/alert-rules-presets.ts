import type { AlertRule } from "./alert-rules";

export const RECOMMENDED_ALERT_RULES: AlertRule[] = [
  {
    id: "disk-85",
    enabled: true,
    metric: "disk",
    threshold: 85,
    channel: "email",
    target: "",
  },
  {
    id: "mem-90",
    enabled: true,
    metric: "memory",
    threshold: 90,
    channel: "email",
    target: "",
  },
  {
    id: "load-8",
    enabled: true,
    metric: "load",
    threshold: 8,
    channel: "email",
    target: "",
  },
  {
    id: "backup-48h",
    enabled: false,
    metric: "backup_age",
    threshold: 48,
    channel: "email",
    target: "",
  },
  {
    id: "ssl-14d",
    enabled: false,
    metric: "ssl_expiry",
    threshold: 14,
    channel: "email",
    target: "",
  },
];
