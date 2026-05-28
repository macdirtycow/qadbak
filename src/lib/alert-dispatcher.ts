import { execFile } from "child_process";
import { promisify } from "util";
import { getHostMetrics } from "./host-metrics";
import { loadAlertSettings } from "./alert-rules";

const execFileAsync = promisify(execFile);

async function sendEmail(to: string, subject: string, body: string) {
  if (!to.trim()) return;
  await execFileAsync(
    "bash",
    ["-c", `printf %s ${JSON.stringify(body)} | mail -s ${JSON.stringify(subject)} ${JSON.stringify(to)}`],
    { timeout: 30_000 },
  );
}

async function sendWebhook(url: string, payload: object) {
  if (!url.trim()) return;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function evaluateAlerts(): Promise<{ fired: string[] }> {
  const settings = await loadAlertSettings();
  const fired: string[] = [];
  let metrics;
  try {
    metrics = await getHostMetrics();
  } catch {
    return { fired };
  }
  const rootDisk = metrics.disks.find((d) => d.mount === "/");
  for (const rule of settings.rules) {
    if (!rule.enabled) continue;
    let hit = false;
    let msg = "";
    if (rule.metric === "disk" && rootDisk) {
      hit = rootDisk.usePct >= rule.threshold;
      msg = `Disk / at ${rootDisk.usePct}% (threshold ${rule.threshold}%)`;
    } else if (rule.metric === "memory") {
      hit = metrics.memory.usePct >= rule.threshold;
      msg = `Memory ${metrics.memory.usePct}% (threshold ${rule.threshold}%)`;
    } else if (rule.metric === "load") {
      hit = metrics.loadAvg[0] >= rule.threshold;
      msg = `Load ${metrics.loadAvg[0]} (threshold ${rule.threshold})`;
    }
    if (!hit) continue;
    fired.push(`${rule.id}: ${msg}`);
    const subject = `[Qadbak] Alert: ${rule.id}`;
    if (rule.channel === "email") {
      const to = rule.target || settings.emailTo || "";
      await sendEmail(to, subject, msg).catch(() => {});
    } else if (rule.channel === "slack" && settings.slackWebhook) {
      await sendWebhook(settings.slackWebhook, { text: msg }).catch(() => {});
    } else if (rule.channel === "telegram" && settings.telegramWebhook) {
      await sendWebhook(settings.telegramWebhook, { text: msg }).catch(() => {});
    }
  }
  return { fired };
}
