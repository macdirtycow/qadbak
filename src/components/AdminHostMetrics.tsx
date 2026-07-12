"use client";

import { Alert, Button, Card } from "@/components/ui";
import type { HostMetrics } from "@/lib/host-metrics-format";
import { formatKb, formatUptime } from "@/lib/host-metrics-format";
import { useState } from "react";

export function AdminHostMetrics({
  initialMetrics,
  initialError,
}: {
  initialMetrics: HostMetrics | null;
  initialError: string;
}) {
  const [metrics, setMetrics] = useState(initialMetrics);
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/host-metrics");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load metrics.");
      setMetrics(data.metrics ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  if (!metrics && error) {
    return <Alert>{error}</Alert>;
  }
  if (!metrics) return null;

  const loadPerCpu = metrics.cpuCount
    ? metrics.loadAvg.map((l) => (l / metrics.cpuCount).toFixed(2))
    : metrics.loadAvg.map(String);

  return (
    <div className="space-y-4">
      {error && <Alert>{error}</Alert>}
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-panel-muted">
          Live host metrics ({metrics.hostname})
        </p>
        <Button variant="secondary" disabled={loading} onClick={() => refresh()}>
          {loading ? "Refreshing…" : "Refresh"}
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-xs uppercase tracking-wide text-panel-muted">Uptime</p>
          <p className="mt-2 text-xl font-medium text-white">
            {formatUptime(metrics.uptimeSeconds)}
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-panel-muted">Load (1/5/15m)</p>
          <p className="mt-2 text-xl font-medium text-white">
            {metrics.loadAvg.join(" / ")}
          </p>
          <p className="mt-1 text-xs text-panel-muted">
            per CPU: {loadPerCpu.join(" / ")} ({metrics.cpuCount} cores)
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-panel-muted">Memory</p>
          <p className="mt-2 text-xl font-medium text-white">
            {metrics.memory.usePct}% used
          </p>
          <p className="mt-1 text-xs text-panel-muted">
            {formatKb(metrics.memory.usedKb)} / {formatKb(metrics.memory.totalKb)}
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-panel-muted">Firewall</p>
          <p className="mt-2 text-lg font-medium text-white">
            {metrics.firewall?.summary ?? " - "}
          </p>
          {metrics.firewall?.tool && (
            <p className="mt-1 text-xs text-panel-muted">{metrics.firewall.tool}</p>
          )}
        </Card>
      </div>
      <Card>
        <h2 className="text-lg font-medium text-white">Disk</h2>
        <table className="mt-4 w-full text-left text-sm">
          <thead className="border-t border-panel-border text-panel-muted">
            <tr>
              <th className="py-2 pr-4">Mount</th>
              <th className="py-2 pr-4">Used</th>
              <th className="py-2 pr-4">Total</th>
              <th className="py-2">Use</th>
            </tr>
          </thead>
          <tbody>
            {metrics.disks.map((d) => (
              <tr key={d.mount} className="border-t border-panel-border/50">
                <td className="py-2 pr-4 text-white">{d.mount}</td>
                <td className="py-2 pr-4 text-panel-muted">{formatKb(d.usedKb)}</td>
                <td className="py-2 pr-4 text-panel-muted">{formatKb(d.totalKb)}</td>
                <td className="py-2">
                  <span
                    className={
                      d.usePct >= 90
                        ? "text-amber-400"
                        : d.usePct >= 75
                          ? "text-yellow-300"
                          : "text-panel-muted"
                    }
                  >
                    {d.usePct}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
