"use client";

import { Alert, Button, Card, Input, Label } from "@/components/ui";
import { useEffect, useState } from "react";

export function AdminFirewallView() {
  const [status, setStatus] = useState("");
  const [rules, setRules] = useState<string[]>([]);
  const [port, setPort] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/firewall");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Load failed");
    setStatus(String(data.raw ?? data.summary ?? ""));
    setRules((data.rules as string[]) ?? []);
  }

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Error"));
  }, []);

  async function act(action: "allow" | "deny") {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/firewall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, port }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Firewall</h1>
        <p className="mt-1 text-sm text-panel-muted">Native UFW — no server-admin embed.</p>
      </div>
      {error && <Alert>{error}</Alert>}
      <Card>
        <pre className="max-h-48 overflow-auto text-xs text-panel-muted whitespace-pre-wrap">
          {status || "Loading…"}
        </pre>
        {rules.length > 0 && (
          <ul className="mt-4 text-sm text-panel-muted">
            {rules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}
      </Card>
      <Card className="flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="fw-port">TCP port</Label>
          <Input id="fw-port" value={port} onChange={(e) => setPort(e.target.value)} />
        </div>
        <Button disabled={loading} onClick={() => act("allow")}>
          Allow
        </Button>
        <Button variant="secondary" disabled={loading} onClick={() => act("deny")}>
          Deny
        </Button>
      </Card>
    </div>
  );
}
