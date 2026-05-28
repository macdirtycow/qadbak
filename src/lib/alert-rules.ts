import fs from "fs/promises";
import path from "path";

const RULES_PATH = path.join(process.cwd(), "data", "alert-rules.json");

export interface AlertRule {
  id: string;
  enabled: boolean;
  metric: "disk" | "memory" | "load" | "backup_age" | "ssl_expiry";
  threshold: number;
  channel: "email" | "slack" | "telegram";
  target: string;
}

export interface AlertSettings {
  emailTo?: string;
  slackWebhook?: string;
  telegramWebhook?: string;
  rules: AlertRule[];
}

const DEFAULTS: AlertSettings = {
  emailTo: "",
  rules: [
    {
      id: "disk-85",
      enabled: true,
      metric: "disk",
      threshold: 85,
      channel: "email",
      target: "",
    },
  ],
};

export async function loadAlertSettings(): Promise<AlertSettings> {
  try {
    const raw = await fs.readFile(RULES_PATH, "utf8");
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveAlertSettings(settings: AlertSettings): Promise<void> {
  await fs.mkdir(path.dirname(RULES_PATH), { recursive: true });
  await fs.writeFile(RULES_PATH, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
}
