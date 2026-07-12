"use client";

import { Alert, Button, Card } from "@/components/ui";
import { useCallback, useEffect, useState } from "react";

type CronJob = { schedule: string; command: string; raw: string };

export function AdminCronView() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/cron");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load cron.");
      setJobs(data.jobs ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="font-medium text-white">System cron (root)</h2>
        <p className="mt-1 text-sm text-panel-muted">
          Server-wide scheduled jobs - native view, no server-admin embed.
        </p>
        {loading ? (
          <p className="mt-4 text-sm text-panel-muted">Loading…</p>
        ) : jobs.length === 0 ? (
          <p className="mt-4 text-sm text-panel-muted">No root crontab entries.</p>
        ) : (
          <ul className="mt-4 divide-y divide-panel-border text-sm">
            {jobs.map((j) => (
              <li key={j.raw} className="py-3">
                <code className="text-panel-link">{j.schedule}</code>
                <p className="mt-1 font-mono text-xs text-slate-400">{j.command}</p>
              </li>
            ))}
          </ul>
        )}
        <Button type="button" variant="secondary" className="mt-4" onClick={load} disabled={loading}>
          Refresh
        </Button>
      </Card>
      {error ? <Alert variant="error">{error}</Alert> : null}
    </div>
  );
}
