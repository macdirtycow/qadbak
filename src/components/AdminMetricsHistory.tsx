"use client";

import { Button, Card } from "@/components/ui";
import type { MetricsSnapshot } from "@/lib/metrics-history";
import { useEffect, useState } from "react";

const RANGES = [
  { hours: 24, label: "24 uur" },
  { hours: 168, label: "7 dagen" },
  { hours: 720, label: "30 dagen" },
] as const;

export function AdminMetricsHistory() {
  const [history, setHistory] = useState<MetricsSnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [hours, setHours] = useState(168);

  async function load(h = hours) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/metrics-history?hours=${h}`);
      const data = await res.json();
      if (res.ok) setHistory(data.history ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function snapshot() {
    await fetch("/api/admin/metrics-history", { method: "POST" });
    await load();
  }

  useEffect(() => {
    void load(hours);
  }, [hours]);

  const maxDisk = Math.max(1, ...history.map((h) => h.diskRootUsePct));
  const maxMem = Math.max(
    1,
    ...history.map((h) =>
      h.memTotalKb > 0 ? Math.round((h.memUsedKb / h.memTotalKb) * 100) : 0,
    ),
  );

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-white">Metrics history</h2>
        <div className="flex flex-wrap gap-2">
          {RANGES.map((r) => (
            <button
              key={r.hours}
              type="button"
              onClick={() => setHours(r.hours)}
              className={`rounded px-2 py-1 text-xs ${
                hours === r.hours
                  ? "bg-panel-accent text-white"
                  : "bg-panel-border text-panel-muted"
              }`}
            >
              {r.label}
            </button>
          ))}
          <Button variant="secondary" disabled={loading} onClick={() => void load()}>
            Refresh
          </Button>
          <Button disabled={loading} onClick={() => snapshot()}>
            Record snapshot
          </Button>
        </div>
      </div>
      {history.length === 0 ? (
        <p className="text-sm text-panel-muted">
          No history yet. Add cron: provisioning-helper metrics-snapshot
        </p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-xs text-panel-muted mb-2">Disk / use %</p>
            <div className="flex h-24 items-end gap-px">
              {history.slice(-48).map((h) => (
                <div
                  key={h.ts}
                  className="flex-1 bg-brand/70 min-w-[2px]"
                  style={{ height: `${(h.diskRootUsePct / maxDisk) * 100}%` }}
                  title={`${h.ts}: ${h.diskRootUsePct}%`}
                />
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-panel-muted mb-2">Memory use %</p>
            <div className="flex h-24 items-end gap-px">
              {history.slice(-48).map((h) => {
                const pct =
                  h.memTotalKb > 0
                    ? Math.round((h.memUsedKb / h.memTotalKb) * 100)
                    : 0;
                return (
                  <div
                    key={`m-${h.ts}`}
                    className="flex-1 bg-emerald-500/70 min-w-[2px]"
                    style={{ height: `${(pct / maxMem) * 100}%` }}
                    title={`${h.ts}: ${pct}%`}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
