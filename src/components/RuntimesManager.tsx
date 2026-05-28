"use client";

import { Alert, Button, Card, Input, Label } from "@/components/ui";
import { useState } from "react";
import { DomainPageHeader } from "./DomainPageHeader";

type RuntimeApp = {
  type: string;
  name: string;
  port?: number;
  path?: string;
  unit?: string;
};

export function RuntimesManager({
  domain,
  initialRuntimes,
  phpFpmSocket,
  initialError,
  isAdmin,
}: {
  domain: string;
  initialRuntimes: { apps?: RuntimeApp[] };
  phpFpmSocket: string;
  initialError: string;
  isAdmin: boolean;
}) {
  const enc = encodeURIComponent(domain);
  const [runtimes, setRuntimes] = useState(initialRuntimes);
  const [error, setError] = useState(initialError);
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [nodeName, setNodeName] = useState("app");
  const [nodePort, setNodePort] = useState("3000");

  async function refresh() {
    const res = await fetch(`/api/domains/${enc}/runtimes`);
    const data = await res.json();
    if (res.ok) {
      setRuntimes(data.runtimes ?? { apps: [] });
    }
  }

  async function installNode(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdmin) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/domains/${enc}/runtimes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "node",
          name: nodeName,
          port: Number(nodePort) || 3000,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Install failed.");
      setSuccess("Node.js app installed and proxied.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  const apps = runtimes.apps ?? [];

  return (
    <div className="space-y-6">
      <DomainPageHeader
        domain={domain}
        title="Runtimes"
        description="PHP-FPM socket, Node.js, Python, and Docker (native)"
      />
      {error && <Alert>{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <Card>
        <h2 className="text-lg font-medium text-white">PHP</h2>
        <p className="mt-2 text-sm text-panel-muted">
          Per-directory PHP versions: use the <strong>PHP</strong> tab. Active FPM socket:{" "}
          <code className="text-panel-link">{phpFpmSocket || "—"}</code>
        </p>
      </Card>

      <Card>
        <h2 className="text-lg font-medium text-white">Installed apps</h2>
        {apps.length === 0 ? (
          <p className="mt-2 text-sm text-panel-muted">No Node/Python/Docker apps yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-panel-border">
            {apps.map((a) => (
              <li key={`${a.type}-${a.name}`} className="py-3 text-sm">
                <span className="text-white">{a.type}</span> — {a.name}
                {a.port != null && ` · port ${a.port}`}
                {a.path && ` · proxy ${a.path}`}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {isAdmin && (
        <Card>
          <h2 className="text-lg font-medium text-white">Add Node.js app</h2>
          <form onSubmit={installNode} className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <Label>Name</Label>
              <Input value={nodeName} onChange={(e) => setNodeName(e.target.value)} />
            </div>
            <div>
              <Label>Port</Label>
              <Input value={nodePort} onChange={(e) => setNodePort(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={loading}>
                {loading ? "Working…" : "Install Node"}
              </Button>
            </div>
          </form>
          <p className="mt-3 text-xs text-panel-muted">
            Python and Docker: use API or CLI (`runtimes-python-install`, `runtimes-docker-install`).
          </p>
        </Card>
      )}
    </div>
  );
}
