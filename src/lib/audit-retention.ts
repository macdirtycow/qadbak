import "server-only";

import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const LOG_PATH = path.join(process.cwd(), "data", "audit.log");

export function auditRetentionConfig(): {
  maxLines: number;
  retentionDays: number;
} {
  const maxRaw = process.env.QADBAK_AUDIT_MAX_LINES?.trim();
  const daysRaw = process.env.QADBAK_AUDIT_RETENTION_DAYS?.trim();
  const maxLines = maxRaw ? Number(maxRaw) : 50_000;
  const retentionDays = daysRaw ? Number(daysRaw) : 0;
  return {
    maxLines:
      Number.isFinite(maxLines) && maxLines >= 1000 ? Math.floor(maxLines) : 50_000,
    retentionDays:
      Number.isFinite(retentionDays) && retentionDays > 0
        ? Math.floor(retentionDays)
        : 0,
  };
}

/** Trim audit.log by age and line count (best-effort, non-fatal). */
export async function rotateAuditLogIfNeeded(): Promise<void> {
  const { maxLines, retentionDays } = auditRetentionConfig();
  let raw: string;
  try {
    raw = await readFile(LOG_PATH, "utf8");
  } catch {
    return;
  }
  let lines = raw.trim().split("\n").filter(Boolean);
  if (retentionDays > 0) {
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    lines = lines.filter((line) => {
      try {
        const ts = JSON.parse(line) as { ts?: string };
        return ts.ts ? Date.parse(ts.ts) >= cutoff : true;
      } catch {
        return true;
      }
    });
  }
  if (lines.length > maxLines) {
    lines = lines.slice(-maxLines);
  }
  const next = lines.length ? `${lines.join("\n")}\n` : "";
  if (next === raw) return;
  const tmp = `${LOG_PATH}.rotate-${process.pid}`;
  await writeFile(tmp, next, "utf8");
  await rename(tmp, LOG_PATH);
}
