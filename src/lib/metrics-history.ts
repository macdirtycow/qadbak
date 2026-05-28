import fs from "fs/promises";
import path from "path";

const HISTORY = path.join(process.cwd(), "data", "metrics-history.jsonl");

export interface MetricsSnapshot {
  ts: string;
  load1: number;
  load5: number;
  load15: number;
  uptimeSec: number;
  memUsedKb: number;
  memTotalKb: number;
  diskRootUsePct: number;
}

export async function readMetricsHistory(hours = 24): Promise<MetricsSnapshot[]> {
  const since = Date.now() - hours * 3600 * 1000;
  let raw = "";
  try {
    raw = await fs.readFile(HISTORY, "utf8");
  } catch {
    return [];
  }
  const rows: MetricsSnapshot[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line) as MetricsSnapshot;
      if (new Date(row.ts).getTime() >= since) rows.push(row);
    } catch {
      /* skip */
    }
  }
  return rows.sort((a, b) => a.ts.localeCompare(b.ts));
}
