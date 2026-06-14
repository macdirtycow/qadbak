"use client";

import { Alert, Button, Card } from "@/components/ui";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type AwstatsRow = {
  domain: string;
  configured: boolean;
  enabled: boolean;
  configPath: string;
};

export function AdminAwstatsView() {
  const [rows, setRows] = useState<AwstatsRow[]>([]);
  const [installed, setInstalled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/awstats");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load AWStats.");
      setRows(data.domains ?? []);
      setInstalled(Boolean(data.awstatsInstalled));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const configured = rows.filter((r) => r.configured).length;

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="font-medium text-white">AWStats (server-wide)</h2>
        <p className="mt-1 text-sm text-panel-muted">
          Per-domain traffic stats — {installed ? "awstats installed" : "awstats not detected on PATH"}.
          {" "}
          {configured}/{rows.length} domains configured.
        </p>
        {loading ? (
          <p className="mt-4 text-sm text-panel-muted">Loading…</p>
        ) : (
          <ul className="mt-4 divide-y divide-panel-border text-sm">
            {rows.map((r) => (
              <li key={r.domain} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <Link
                  href={`/domains/${encodeURIComponent(r.domain)}/tools`}
                  className="font-medium text-white hover:text-panel-link"
                >
                  {r.domain}
                </Link>
                <span className={r.configured ? "text-emerald-400" : "text-amber-400"}>
                  {r.configured ? "configured" : "not configured"}
                  {r.enabled ? "" : " · disabled"}
                </span>
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
