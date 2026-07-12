"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Button, Card, Input, Label } from "@/components/ui";
import type { AuditEntry } from "@/lib/audit-read";

type AuditResponse = {
  entries: AuditEntry[];
  scannedLines: number;
  stats: { failedLogins: number; logins: number };
  error?: string;
};

export function AdminAuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [stats, setStats] = useState({ failedLogins: 0, logins: 0 });
  const [scanned, setScanned] = useState(0);
  const [action, setAction] = useState("");
  const [username, setUsername] = useState("");
  const [since, setSince] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const q = new URLSearchParams({ limit: "300" });
      if (action.trim()) q.set("action", action.trim());
      if (username.trim()) q.set("username", username.trim());
      if (since) q.set("since", since);
      const res = await fetch(`/api/admin/audit?${q}`);
      const data = (await res.json()) as AuditResponse;
      if (!res.ok) throw new Error(data.error ?? "Load failed");
      setEntries(data.entries);
      setStats(data.stats);
      setScanned(data.scannedLines);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [action, username, since]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      {error && <Alert>{error}</Alert>}

      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[140px] flex-1">
            <Label htmlFor="audit-action">Action contains</Label>
            <Input
              id="audit-action"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder="login, firewall, backup…"
            />
          </div>
          <div className="min-w-[140px] flex-1">
            <Label htmlFor="audit-user">Username contains</Label>
            <Input
              id="audit-user"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
            />
          </div>
          <div>
            <Label htmlFor="audit-since">Since</Label>
            <select
              id="audit-since"
              className="mt-1 block w-full rounded-md border border-panel-border bg-panel-bg px-3 py-2 text-sm text-white"
              value={since}
              onChange={(e) => setSince(e.target.value)}
            >
              <option value="">All (tail)</option>
              <option value="24h">Last 24 hours</option>
            </select>
          </div>
          <Button onClick={() => void load()} disabled={loading}>
            {loading ? "Loading…" : "Apply filters"}
          </Button>
        </div>
        <p className="mt-3 text-sm text-panel-muted">
          Scanned ~{scanned} lines from <code className="text-white">data/audit.log</code> ·{" "}
          {stats.logins} logins · {stats.failedLogins} failed logins in this view ·{" "}
          <Link href="/admin/privacy" className="text-panel-link hover:underline">
            Privacy &amp; data
          </Link>
        </p>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-panel-border text-panel-muted">
              <th className="py-2 pr-3">Time</th>
              <th className="py-2 pr-3">User</th>
              <th className="py-2 pr-3">Action</th>
              <th className="py-2 pr-3">Domain</th>
              <th className="py-2">Detail</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="py-6 text-panel-muted">
                  No audit entries match your filters.
                </td>
              </tr>
            )}
            {entries.map((row, i) => (
              <tr
                key={`${row.ts}-${row.action}-${i}`}
                className={`border-b border-panel-border/50 ${
                  row.action === "login-failed" ? "bg-red-950/20" : ""
                }`}
              >
                <td className="py-2 pr-3 whitespace-nowrap text-panel-muted">
                  {new Date(row.ts).toLocaleString()}
                </td>
                <td className="py-2 pr-3 text-white">{row.username}</td>
                <td className="py-2 pr-3 font-mono text-xs text-white">{row.action}</td>
                <td className="py-2 pr-3 text-panel-muted">{row.domain ?? " - "}</td>
                <td className="py-2 max-w-xs truncate text-panel-muted" title={row.detail}>
                  {row.detail ?? " - "}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
