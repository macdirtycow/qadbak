import { execFile } from "node:child_process";
import { readFile, appendFile, mkdir } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";
import { emit, QADBAK_DIR } from "./provisioning-common.mjs";

const exec = promisify(execFile);
const HISTORY = path.join(QADBAK_DIR, "data", "metrics-history.jsonl");

async function readMem() {
  const raw = await readFile("/proc/meminfo", "utf8");
  const lines = Object.fromEntries(
    raw
      .split("\n")
      .map((l) => l.split(":"))
      .filter((p) => p.length === 2)
      .map(([k, v]) => [k.trim(), Number.parseInt(v.trim(), 10) || 0]),
  );
  const total = lines.MemTotal ?? 0;
  const avail = lines.MemAvailable ?? lines.MemFree ?? 0;
  return { totalKb: total, usedKb: Math.max(0, total - avail) };
}

export async function metricsSnapshot() {
  const [loadRaw, uptimeRaw, mem, dfOut] = await Promise.all([
    readFile("/proc/loadavg", "utf8"),
    readFile("/proc/uptime", "utf8"),
    readMem(),
    exec("df", ["-kP", "/"], { timeout: 10_000 }).then((r) => r.stdout),
  ]);
  const load = loadRaw.trim().split(/\s+/).slice(0, 3).map(Number);
  const uptimeSec = Number.parseFloat(uptimeRaw.split(/\s+/)[0] ?? "0");
  const dfLine = dfOut.split("\n")[1]?.split(/\s+/) ?? [];
  const diskUsedPct = Number.parseInt(String(dfLine[4] ?? "0").replace("%", ""), 10) || 0;
  const row = {
    ts: new Date().toISOString(),
    load1: load[0] ?? 0,
    load5: load[1] ?? 0,
    load15: load[2] ?? 0,
    uptimeSec,
    memUsedKb: mem.usedKb,
    memTotalKb: mem.totalKb,
    diskRootUsePct: diskUsedPct,
  };
  await mkdir(path.dirname(HISTORY), { recursive: true });
  await appendFile(HISTORY, `${JSON.stringify(row)}\n`, "utf8");
  emit({ ok: true, snapshot: row });
}
