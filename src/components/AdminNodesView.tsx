"use client";

import { Alert, Button, Card } from "@/components/ui";
import type { NodeHealth } from "@/lib/node-agent-client";
import type { QadbakNode } from "@/lib/servers";
import { useCallback, useEffect, useState } from "react";

export function AdminNodesView() {
  const [nodes, setNodes] = useState<QadbakNode[]>([]);
  const [health, setHealth] = useState<NodeHealth[]>([]);
  const [defaultNodeId, setDefaultNodeId] = useState("local");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [provisioner, setProvisioner] = useState<"native" | "hybrid">("native");
  const [form, setForm] = useState({ id: "", name: "", agentUrl: "" });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/nodes");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load nodes.");
      setNodes(data.nodes ?? []);
      setHealth(data.health ?? []);
      setDefaultNodeId(data.defaultNodeId ?? "local");
      setProvisioner(data.provisioner === "hybrid" ? "hybrid" : "native");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addNode(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError("");
    try {
      const res = await fetch("/api/admin/nodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add node.");
      setForm({ id: "", name: "", agentUrl: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error.");
    } finally {
      setAdding(false);
    }
  }

  const healthById = Object.fromEntries(health.map((h) => [h.id, h]));

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="font-medium text-white">Hosting nodes</h2>
        <p className="mt-1 text-sm text-panel-muted">
          {provisioner === "native"
            ? "Provisioning runs on this server via native helpers."
            : "Remote nodes can expose a legacy API URL. Each node runs qadbak-node-agent (port 9100)."}
        </p>
        {loading ? (
          <p className="mt-4 text-sm text-panel-muted">Loading…</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {nodes.map((n) => {
              const h = healthById[n.id];
              return (
                <li
                  key={n.id}
                  className="rounded-lg border border-panel-border/80 bg-panel-card/40 px-4 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-medium text-white">{n.name}</span>
                      <span className="ml-2 text-xs text-panel-muted">({n.id})</span>
                      {n.isDefault || n.id === defaultNodeId ? (
                        <span className="ml-2 rounded bg-panel-accent/20 px-2 py-0.5 text-xs text-panel-link">
                          default
                        </span>
                      ) : null}
                    </div>
                    <span
                      className={
                        h?.ok
                          ? "text-sm text-emerald-400"
                          : "text-sm text-amber-400"
                      }
                    >
                      {h?.ok
                        ? `Agent OK${h.latencyMs != null ? ` · ${h.latencyMs}ms` : ""}`
                        : `Agent unreachable${h?.error ? `: ${h.error}` : ""}`}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-panel-muted">
                    {n.agentUrl ?? "—"} · roles: {n.roles.join(", ")}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
        <Button type="button" variant="secondary" className="mt-4" onClick={load} disabled={loading}>
          Refresh health
        </Button>
      </Card>

      <Card>
        <h2 className="font-medium text-white">Add remote node</h2>
        <p className="mt-1 text-sm text-panel-muted">
          Install Qadbak agent on the second VPS, open firewall from this panel host to{" "}
          <code className="text-white">:9100</code>, set the same{" "}
          <code className="text-white">QADBAK_NODE_AGENT_TOKEN</code> there.
        </p>
        <form onSubmit={addNode} className="mt-4 grid gap-3 sm:max-w-lg">
          <label className="block text-sm">
            <span className="text-panel-muted">Node id</span>
            <input
              className="mt-1 w-full rounded border border-panel-border bg-panel-card px-3 py-2 text-white"
              value={form.id}
              onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
              placeholder="vps2"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-panel-muted">Display name</span>
            <input
              className="mt-1 w-full rounded border border-panel-border bg-panel-card px-3 py-2 text-white"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Contabo VPS 2"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-panel-muted">Agent URL</span>
            <input
              className="mt-1 w-full rounded border border-panel-border bg-panel-card px-3 py-2 text-white"
              value={form.agentUrl}
              onChange={(e) => setForm((f) => ({ ...f, agentUrl: e.target.value }))}
              placeholder="http://10.0.0.2:9100"
              required
            />
          </label>
          <Button type="submit" disabled={adding}>
            {adding ? "Adding…" : "Add node"}
          </Button>
        </form>
      </Card>

      {error ? <Alert variant="error">{error}</Alert> : null}
    </div>
  );
}
