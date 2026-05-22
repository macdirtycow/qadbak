"use client";

import { Alert, Button, Card } from "@/components/ui";
import type { StackCheck } from "@/lib/stack-helper-sudo";
import { useCallback, useEffect, useState } from "react";

export function AdminStackView() {
  const [available, setAvailable] = useState(true);
  const [checks, setChecks] = useState<StackCheck[]>([]);
  const [error, setError] = useState("");
  const [log, setLog] = useState("");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [port, setPort] = useState("11000");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/stack");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load stack status.");
      setAvailable(data.available !== false);
      if (data.available === false) {
        setError(data.error ?? "Stack helper unavailable.");
        setChecks([]);
        return;
      }
      setChecks(data.checks ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function action(name: string, body?: Record<string, unknown>) {
    setActing(name);
    setError("");
    setLog("");
    try {
      const res = await fetch("/api/admin/stack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? { action: name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed.");
      setLog(data.output ?? `${name} completed.`);
      if (data.validation?.checks) setChecks(data.validation.checks);
      else await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="space-y-6">
      {error && <Alert>{error}</Alert>}
      {!available && (
        <Alert>
          Run on the VPS:{" "}
          <code className="text-xs">sudo bash /opt/qadbak/scripts/configure-stack-helper-sudo.sh</code>
        </Alert>
      )}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium text-white">Config validation</h2>
          <Button variant="secondary" disabled={loading || !available} onClick={() => load()}>
            {loading ? "Loading…" : "Re-validate"}
          </Button>
        </div>
        <p className="mt-1 text-sm text-panel-muted">
          nginx, Apache, mail, MariaDB, BIND, firewall — without Webmin server modules.
        </p>
        <ul className="mt-4 divide-y divide-panel-border">
          {checks.map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-4 py-3">
              <div>
                <span className="text-white">{c.label}</span>
                <p className="mt-0.5 text-sm text-panel-muted">{c.detail}</p>
              </div>
              <span
                className={
                  c.ok ? "text-emerald-400 text-sm" : "text-amber-400 text-sm shrink-0"
                }
              >
                {c.ok ? "OK" : "Issue"}
              </span>
            </li>
          ))}
          {!loading && checks.length === 0 && (
            <li className="py-3 text-sm text-panel-muted">No checks returned.</li>
          )}
        </ul>
      </Card>

      <Card>
        <h2 className="text-lg font-medium text-white">Actions</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={!available || acting !== null}
            onClick={() => action("nginx-reload")}
          >
            Reload nginx
          </Button>
          <Button
            variant="secondary"
            disabled={!available || acting !== null}
            onClick={() => action("apache-reload")}
          >
            Reload Apache
          </Button>
          <Button
            variant="secondary"
            disabled={!available || acting !== null}
            onClick={() => action("apply-nginx-vhosts")}
          >
            Apply customer nginx vhosts
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <label className="text-sm text-panel-muted">
            Open firewall port
            <input
              type="number"
              min={1}
              max={65535}
              value={port}
              onChange={(e) => setPort(e.target.value)}
              className="ml-2 w-24 rounded border border-panel-border bg-panel-card px-2 py-1 text-white"
            />
          </label>
          <Button
            variant="secondary"
            disabled={!available || acting !== null}
            onClick={() => action("ufw-allow", { action: "ufw-allow", port: Number(port) })}
          >
            ufw allow
          </Button>
        </div>
        {log && (
          <pre className="mt-4 max-h-48 overflow-auto rounded bg-black/30 p-3 text-xs text-panel-muted">
            {log}
          </pre>
        )}
      </Card>
    </div>
  );
}
