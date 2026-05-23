"use client";

import {
  Alert,
  Button,
  Card,
  ConfirmDialog,
  Input,
  Label,
} from "@/components/ui";
import type { UrlRedirect } from "@/lib/provisioner";
import { useState } from "react";
import { DomainPageHeader } from "./DomainPageHeader";

export function RedirectsManager({
  domain,
  initialRedirects,
  initialError,
}: {
  domain: string;
  initialRedirects: UrlRedirect[];
  initialError: string;
}) {
  const enc = encodeURIComponent(domain);
  const [redirects, setRedirects] = useState(initialRedirects);
  const [error, setError] = useState(initialError);
  const [success, setSuccess] = useState("");
  const [path, setPath] = useState("/");
  const [dest, setDest] = useState("");
  const [rtype, setRtype] = useState("301");
  const [loading, setLoading] = useState(false);
  const [deletePath, setDeletePath] = useState<string | null>(null);
  const [confirmTyped, setConfirmTyped] = useState("");

  async function refresh() {
    const res = await fetch(`/api/domains/${enc}/redirects`);
    const data = await res.json();
    if (res.ok) setRedirects(data.redirects ?? []);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/domains/${enc}/redirects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, dest, type: rtype }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Create failed.");
      setSuccess("Redirect created.");
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
      const res = await fetch(`/api/domains/${enc}/redirects`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: deletePath }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed.");
      setSuccess("Redirect deleted.");
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
      <DomainPageHeader domain={domain} title="URL-redirects" />
      {error && <Alert>{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <Card>
        <h2 className="text-lg font-medium text-white">Add redirect</h2>
        <form onSubmit={create} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="path">Path</Label>
            <Input id="path" value={path} onChange={(e) => setPath(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="dest">Destination URL</Label>
            <Input id="dest" value={dest} onChange={(e) => setDest(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="rtype">Type</Label>
            <select
              id="rtype"
              className="w-full rounded-lg border border-panel-border bg-panel-bg px-3 py-2 text-sm"
              value={rtype}
              onChange={(e) => setRtype(e.target.value)}
            >
              <option value="301">301 permanent</option>
              <option value="302">302 temporary</option>
            </select>
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={loading}>Add</Button>
          </div>
        </form>
      </Card>

      <Card className="overflow-hidden p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-panel-border bg-panel-bg/50 text-panel-muted">
            <tr>
              <th className="px-6 py-3">Path</th>
              <th className="px-6 py-3">Destination</th>
              <th className="px-6 py-3">Type</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {redirects.map((r) => (
              <tr key={r.path} className="border-b border-panel-border/50">
                <td className="px-6 py-4 text-white">{r.path}</td>
                <td className="px-6 py-4 text-panel-muted break-all">{r.dest}</td>
                <td className="px-6 py-4">{r.type ?? "301"}</td>
                <td className="px-6 py-4 text-right">
                  <Button variant="danger" onClick={() => setDeletePath(r.path)}>
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {redirects.length === 0 && (
          <p className="px-6 py-8 text-center text-panel-muted">No redirects.</p>
        )}
      </Card>

      <ConfirmDialog
        open={!!deletePath}
        title="Delete redirect"
        description={`Delete redirect for path ${deletePath}?`}
        confirmLabel="Delete"
        confirmValue={deletePath ?? ""}
        typedValue={confirmTyped}
        onTypedChange={setConfirmTyped}
        onConfirm={confirmDelete}
        onCancel={() => { setDeletePath(null); setConfirmTyped(""); }}
        loading={loading}
      />
    </div>
  );
}
