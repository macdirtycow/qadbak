"use client";

import { Alert, Button, Card, Input, Label } from "@/components/ui";
import { useEffect, useState } from "react";

type KeyRow = {
  id: string;
  label: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt?: string;
};

export function AdminApiKeysView() {
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [label, setLabel] = useState("WHMCS");
  const [newSecret, setNewSecret] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/api-keys");
    const data = await res.json();
    if (res.ok) setKeys(data.keys ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    setLoading(true);
    setError("");
    setNewSecret("");
    try {
      const res = await fetch("/api/admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          scopes: [
            "domains:read",
            "domains:write",
            "mail:read",
            "mail:write",
            "dns:read",
            "dns:write",
            "ssl:read",
            "ssl:write",
            "backups:read",
            "backups:write",
            "limits:read",
            "limits:write",
            "plans:read",
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setNewSecret(data.secret ?? "");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function revoke(id: string) {
    await fetch("/api/admin/api-keys", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">API keys (v1)</h1>
        <p className="mt-1 text-sm text-panel-muted">
          Bearer token for <code>/api/v1/*</code>
        </p>
      </div>
      <Card className="border-panel-accent/30 bg-panel-accent/5 space-y-3">
        <h2 className="text-sm font-medium text-white">Integrations</h2>
        <ul className="text-sm text-panel-muted space-y-2">
          <li>
            <a
              href="https://github.com/macdirtycow/qadbak/blob/main/docs/api/openapi.yaml"
              className="text-panel-link hover:underline"
              rel="noopener noreferrer"
              target="_blank"
            >
              OpenAPI spec
            </a>{" "}
            — domains, mail, DNS, SSL, backups, suspend
          </li>
          <li>
            <a
              href="https://github.com/macdirtycow/qadbak/blob/main/docs/integrations/WHMCS-INTEGRATION.md"
              className="text-panel-link hover:underline"
              rel="noopener noreferrer"
              target="_blank"
            >
              WHMCS module guide
            </a>
          </li>
          <li>
            <code className="text-white">integrations/blesta/</code> — Blesta starter
          </li>
        </ul>
        <p className="text-xs text-panel-muted">
          Tip: create keys with IP allowlist for production billing servers.
        </p>
      </Card>
      {error && <Alert>{error}</Alert>}
      {newSecret && (
        <Alert variant="success">
          Copy now — secret shown once: <code className="text-xs">{newSecret}</code>
        </Alert>
      )}
      <Card className="flex flex-wrap gap-3 items-end">
        <div>
          <Label htmlFor="key-label">Label</Label>
          <Input id="key-label" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <Button disabled={loading} onClick={() => create()}>
          Create key
        </Button>
      </Card>
      <Card>
        <ul className="text-sm space-y-2">
          {keys.map((k) => (
            <li key={k.id} className="flex justify-between gap-4 text-panel-muted">
              <span>
                {k.label} — {k.scopes.join(", ")}
                {k.lastUsedAt ? ` · last ${k.lastUsedAt}` : ""}
              </span>
              <Button variant="secondary" onClick={() => revoke(k.id)}>
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
