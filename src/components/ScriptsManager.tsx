"use client";

import {
  Alert,
  Button,
  Card,
  ConfirmDialog,
  Input,
  Label,
} from "@/components/ui";
import type { AvailableScript, InstalledScript } from "@/lib/provisioner";
import { useState } from "react";
import { DomainPageHeader } from "./DomainPageHeader";

export function ScriptsManager({
  domain,
  initialAvailable,
  initialInstalled,
  isAdmin,
  initialError,
}: {
  domain: string;
  initialAvailable: AvailableScript[];
  initialInstalled: InstalledScript[];
  isAdmin: boolean;
  initialError: string;
}) {
  const enc = encodeURIComponent(domain);
  const [available] = useState(initialAvailable);
  const [installed, setInstalled] = useState(initialInstalled);
  const [error, setError] = useState(initialError);
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [installScript, setInstallScript] = useState("");
  const [installPath, setInstallPath] = useState("public_html");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [confirmTyped, setConfirmTyped] = useState("");

  async function refresh() {
    const res = await fetch(`/api/domains/${enc}/scripts`);
    const data = await res.json();
    if (res.ok) setInstalled(data.installed ?? []);
  }

  async function doInstall(e: React.FormEvent) {
    e.preventDefault();
    if (!installScript) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/domains/${enc}/scripts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: installScript, path: installPath }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Install failed.");
      setSuccess(`${installScript} installed.`);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/domains/${enc}/scripts`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: deleteTarget }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed.");
      setSuccess("Script deleted.");
      setDeleteTarget(null);
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
      <DomainPageHeader
        domain={domain}
        title="Script installers"
        description="WordPress, Drupal, and other apps"
      />
      {error && <Alert>{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <Card>
        <h2 className="text-lg font-medium text-white">Installed</h2>
        {installed.length === 0 ? (
          <p className="mt-3 text-sm text-panel-muted">No scripts installed.</p>
        ) : (
          <ul className="mt-4 divide-y divide-panel-border">
            {installed.map((s) => (
              <li key={s.name} className="flex justify-between py-3">
                <div>
                  <p className="text-white">{s.name}</p>
                  <p className="text-xs text-panel-muted">
                    {s.version} · {s.path}
                    {s.url && (
                      <>
                        {" "}
                        ·{" "}
                        <a
                          href={s.url}
                          className="text-panel-link hover:underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          open
                        </a>
                      </>
                    )}
                  </p>
                </div>
                {isAdmin && (
                  <Button variant="danger" onClick={() => setDeleteTarget(s.name)}>
                    Delete
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {isAdmin && (
        <Card>
          <h2 className="text-lg font-medium text-white">Install</h2>
          <form onSubmit={doInstall} className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Script</Label>
              <select
                className="mt-1 w-full rounded-lg border border-panel-border bg-panel-bg px-3 py-2 text-sm"
                value={installScript}
                onChange={(e) => setInstallScript(e.target.value)}
                required
              >
                <option value="">Choose…</option>
                {available.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name} {s.version ? `(${s.version})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Directory</Label>
              <Input
                value={installPath}
                onChange={(e) => setInstallPath(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "Working…" : "Install"}
            </Button>
          </form>
        </Card>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete script"
        description={`Delete ${deleteTarget} from ${domain}?`}
        confirmLabel="Delete"
        confirmValue={deleteTarget ?? ""}
        typedValue={confirmTyped}
        onTypedChange={setConfirmTyped}
        onConfirm={confirmDelete}
        onCancel={() => {
          setDeleteTarget(null);
          setConfirmTyped("");
        }}
        loading={loading}
      />
    </div>
  );
}
