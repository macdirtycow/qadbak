import "server-only";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { apnsConfigured, sendApnsNotification } from "./mobile-apns";
import { listAllMobilePushTokens, type MobilePushToken } from "./mobile-push";
import { runGlobalTool } from "./panel-tools";
import { loadUsers } from "./users";

type HealthRow = {
  domain: string;
  disabled?: boolean;
  sslDaysLeft?: number | null;
  backupAgeDays?: number | null;
  containersStopped?: string[];
};

type AlertState = {
  sent: Record<string, string>;
};

const STATE_PATH = path.join(process.cwd(), "data", "mobile-push-alert-state.json");
const DEDUP_MS = 24 * 60 * 60 * 1000;
const BACKUP_STALE_DAYS = 7;

let cache: AlertState | null = null;
let mtimeMs = 0;

async function loadState(): Promise<AlertState> {
  try {
    const { mtimeMs: m } = await stat(STATE_PATH);
    if (cache && m === mtimeMs) return cache;
    const raw = await readFile(STATE_PATH, "utf8");
    cache = JSON.parse(raw) as AlertState;
    mtimeMs = m;
    return cache;
  } catch {
    cache = { sent: {} };
    mtimeMs = 0;
    return cache;
  }
}

async function saveState(state: AlertState): Promise<void> {
  await mkdir(path.dirname(STATE_PATH), { recursive: true });
  await writeFile(STATE_PATH, JSON.stringify(state, null, 2), "utf8");
  cache = state;
  try {
    mtimeMs = (await stat(STATE_PATH)).mtimeMs;
  } catch {
    mtimeMs = 0;
  }
}

function shouldSend(state: AlertState, key: string): boolean {
  const last = state.sent[key];
  if (!last) return true;
  const ts = Date.parse(last);
  return Number.isNaN(ts) || Date.now() - ts >= DEDUP_MS;
}

async function tokensForDomain(domain: string): Promise<MobilePushToken[]> {
  const [tokens, users] = await Promise.all([
    listAllMobilePushTokens(),
    loadUsers(),
  ]);
  const byId = new Map(users.map((u) => [u.id, u]));
  const target = domain.toLowerCase();
  return tokens.filter((row) => {
    const user = byId.get(row.userId);
    if (!user) return false;
    if (user.role === "admin") return true;
    return user.domains.some((d) => d.toLowerCase() === target);
  });
}

async function broadcastAlert(
  domain: string,
  title: string,
  body: string,
  category: string,
  data: Record<string, string>,
): Promise<number> {
  const tokens = await tokensForDomain(domain);
  if (!tokens.length) return 0;
  let delivered = 0;
  await Promise.all(
    tokens.map(async (row) => {
      const ok = await sendApnsNotification(
        row.token,
        { title, body, category, data },
        row.bundleId,
      );
      if (ok) delivered += 1;
    }),
  );
  return delivered;
}

/** Evaluate SSL, backup, and container alerts; deliver APNs to eligible devices. */
export async function evaluateMobilePushAlerts(): Promise<{
  sent: string[];
  delivered: number;
  skipped?: string;
}> {
  if (!apnsConfigured()) {
    return { sent: [], delivered: 0, skipped: "APNs not configured" };
  }
  const raw = await runGlobalTool("domain-health-batch", { excludeDemoOnly: true });
  const rows = ((raw as { domains?: HealthRow[] }).domains ?? []) as HealthRow[];
  const state = await loadState();
  const sent: string[] = [];
  let delivered = 0;
  const now = new Date().toISOString();

  for (const row of rows) {
    if (row.disabled) continue;
    const domain = row.domain;

    if (row.sslDaysLeft != null && row.sslDaysLeft <= 7) {
      const bucket = row.sslDaysLeft <= 0 ? "expired" : "7d";
      const key = `ssl:${domain}:${bucket}`;
      if (shouldSend(state, key)) {
        const body =
          row.sslDaysLeft <= 0
            ? `SSL certificate expired on ${domain}.`
            : `SSL certificate expires in ${row.sslDaysLeft} day(s) on ${domain}.`;
        const n = await broadcastAlert(
          domain,
          "SSL certificate expiring",
          body,
          "ssl_expiry",
          { type: "ssl_expiry", domain },
        );
        if (n > 0) {
          state.sent[key] = now;
          sent.push(key);
          delivered += n;
        }
      }
    }

    if (row.backupAgeDays != null && row.backupAgeDays > BACKUP_STALE_DAYS) {
      const key = `backup:${domain}:${row.backupAgeDays}`;
      if (shouldSend(state, key)) {
        const n = await broadcastAlert(
          domain,
          "Backup overdue",
          `No recent backup on ${domain} (${row.backupAgeDays} days old).`,
          "backup_stale",
          { type: "backup_stale", domain },
        );
        if (n > 0) {
          state.sent[key] = now;
          sent.push(key);
          delivered += n;
        }
      }
    }

    const stopped = row.containersStopped ?? [];
    if (stopped.length > 0) {
      const key = `container:${domain}:${stopped.join(",")}`;
      if (shouldSend(state, key)) {
        const label = stopped.length === 1 ? stopped[0] : stopped.join(", ");
        const n = await broadcastAlert(
          domain,
          "Container stopped",
          `Container stopped on ${domain}: ${label}.`,
          "container_stopped",
          { type: "container_stopped", domain, container: label },
        );
        if (n > 0) {
          state.sent[key] = now;
          sent.push(key);
          delivered += n;
        }
      }
    }
  }

  if (sent.length) await saveState(state);
  return { sent, delivered };
}
