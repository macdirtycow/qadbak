"use client";

import { useState } from "react";
import { Alert, Button, Card, Input, Label } from "@/components/ui";
import type { LicensePublicInfo } from "@/lib/qadbak-license";

export function AdminLicensePanel({
  initialLicense,
  initialError,
}: {
  initialLicense: LicensePublicInfo;
  initialError?: string;
}) {
  const [license, setLicense] = useState(initialLicense);
  const [error, setError] = useState(initialError ?? "");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState("");
  const [modulesSynced, setModulesSynced] = useState<boolean | null>(null);
  const [syncHint, setSyncHint] = useState("");

  async function runAction(action: string, payload: Record<string, string> = {}) {
    setBusy(action);
    setError("");
    try {
      const res = await fetch("/api/admin/license", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = (await res.json()) as {
        error?: string;
        license?: LicensePublicInfo;
        modulesSynced?: boolean;
        modulesSyncError?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      if (data.license) setLicense(data.license);
      if (typeof data.modulesSynced === "boolean") {
        setModulesSynced(data.modulesSynced);
      }
      setSyncHint(data.modulesSyncError ?? "");
      if (action === "activate") setKey("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-6">
      {error && <Alert>{error}</Alert>}
      {syncHint && (
        <Alert>
          License saved, but Premium modules could not be downloaded: {syncHint}.
          Build/upload the Premium bundle on the license server, then click Refresh
          modules.
        </Alert>
      )}
      {modulesSynced === false && license.features.length > 0 && !syncHint && (
        <Alert>
          License is active — click <strong>Refresh modules</strong> to download Premium
          features onto this server.
        </Alert>
      )}
      <Card>
        <h2 className="text-lg font-medium text-white">Qadbak license</h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-panel-muted">Type</dt>
            <dd className="text-white">{license.type}</dd>
          </div>
          <div>
            <dt className="text-sm text-panel-muted">Plan</dt>
            <dd className="text-white">{license.plan}</dd>
          </div>
          <div>
            <dt className="text-sm text-panel-muted">Status</dt>
            <dd className="text-white">{license.status}</dd>
          </div>
          <div>
            <dt className="text-sm text-panel-muted">Key hint</dt>
            <dd className="text-white">{license.keyHint}</dd>
          </div>
          <div>
            <dt className="text-sm text-panel-muted">Domains</dt>
            <dd className="text-white">{license.domains}</dd>
          </div>
          <div>
            <dt className="text-sm text-panel-muted">Expiry</dt>
            <dd className="text-white">{license.expiry}</dd>
          </div>
          <div>
            <dt className="text-sm text-panel-muted">Instance ID</dt>
            <dd className="break-all font-mono text-xs text-white">
              {license.instanceId}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-panel-muted">Last heartbeat</dt>
            <dd className="text-white">{license.lastHeartbeatAt ?? "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-sm text-panel-muted">Premium modules</dt>
            <dd className="text-white">
              {license.features.length
                ? license.features.join(", ")
                : "None (Core evaluation)"}
            </dd>
          </div>
          {license.artifactVersion ? (
            <div>
              <dt className="text-sm text-panel-muted">Artifact version</dt>
              <dd className="text-white">{license.artifactVersion}</dd>
            </div>
          ) : null}
        </dl>
      </Card>

      <Card>
        <h3 className="font-medium text-white">Activate Premium</h3>
        <p className="mt-2 text-sm text-panel-muted">
          Enter your commercial license key from MacDirtyCow / Omiiba.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label htmlFor="license-key">License key</Label>
            <Input
              id="license-key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="QAD-…"
              autoComplete="off"
            />
          </div>
          <Button
            type="button"
            disabled={busy !== "" || !key.trim()}
            onClick={() => runAction("activate", { key })}
          >
            {busy === "activate" ? "Activating…" : "Activate"}
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={busy !== ""}
            onClick={() => runAction("sync")}
          >
            {busy === "sync" ? "Syncing…" : "Refresh modules"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy !== ""}
            onClick={() => runAction("heartbeat")}
          >
            {busy === "heartbeat" ? "Checking…" : "Heartbeat now"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy !== ""}
            onClick={() => runAction("deactivate")}
          >
            Deactivate
          </Button>
        </div>
      </Card>
    </div>
  );
}
