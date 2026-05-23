"use client";

import {
  Alert,
  Button,
  Card,
  ConfirmDialog,
  Input,
  Label,
} from "@/components/ui";
import type { ProxyRoute } from "@/lib/provisioner";
import { useState } from "react";
import { DomainPageHeader } from "./DomainPageHeader";

export function ProxiesManager({
  domain,
  initialProxies,
  isAdmin,
  initialError,
}: {
  domain: string;
  initialProxies: ProxyRoute[];
  isAdmin: boolean;
  initialError: string;
}) {
  const enc = encodeURIComponent(domain);
  const [proxies, setProxies] = useState(initialProxies);
  const [error, setError] = useState(initialError);
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [path, setPath] = useState("/");
  const [dest, setDest] = useState("");
  const [deletePath, setDeletePath] = useState<string | null>(null);
  const [confirmTyped, setConfirmTyped] = useState("");

  async function refresh() {
    const res = await fetch(`/api/domains/${enc}/proxies`);
    const data = await res.json();
    if (res.ok) setProxies(data.proxies ?? []);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/domains/${enc}/proxies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, dest }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Create failed.");
      setSuccess("Proxy added.");
      setPath("/");
      setDest("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  async function confirmDelete() {
    if (!deletePath) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/domains/${enc}/proxies`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: deletePath }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed.");
      setDeletePath(null);
      setConfirmTyped("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <DomainPageHeader domain={domain} title="Proxies" />
      {error && <Alert>{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {isAdmin && (
        <Card>
          <h2 className="text-lg font-medium text-white">Add proxy</h2>
          <form onSubmit={create} className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Path</Label>
              <Input value={path} onChange={(e) => setPath(e.target.value)} />
            </div>
            <div>
              <Label>Destination URL</Label>
              <Input value={dest} onChange={(e) => setDest(e.target.value)} required />
            </div>
            <Button type="submit" disabled={loading}>
              Add
            </Button>
          </form>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-panel-border bg-panel-bg/50 text-panel-muted">
            <tr>
              <th className="px-6 py-3">Path</th>
              <th className="px-6 py-3">Destination</th>
              {isAdmin && <th className="px-6 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {proxies.map((p) => (
              <tr key={p.path} className="border-b border-panel-border/50">
                <td className="px-6 py-4 text-white">{p.path}</td>
                <td className="px-6 py-4 text-panel-muted break-all">{p.dest}</td>
                {isAdmin && (
                  <td className="px-6 py-4 text-right">
                    <Button variant="danger" onClick={() => setDeletePath(p.path)}>
                      Delete
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {proxies.length === 0 && (
          <p className="px-6 py-8 text-center text-panel-muted">No proxies.</p>
        )}
      </Card>

      <ConfirmDialog
        open={!!deletePath}
        title="Delete proxy"
        description={`Delete proxy for path ${deletePath}?`}
        confirmLabel="Delete"
        confirmValue={deletePath ?? ""}
        typedValue={confirmTyped}
        onTypedChange={setConfirmTyped}
        onConfirm={confirmDelete}
        onCancel={() => {
          setDeletePath(null);
          setConfirmTyped("");
        }}
        loading={loading}
      />
    </div>
  );
}
