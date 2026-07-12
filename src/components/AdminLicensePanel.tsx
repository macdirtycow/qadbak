"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Button, Card, Input, Label } from "@/components/ui";
import type {
  LicenseActivationRow,
  LicensePublicInfo,
} from "@/lib/qadbak-license";

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
  const [journalId, setJournalId] = useState("");
  const [activations, setActivations] = useState<LicenseActivationRow[]>([]);
  const [activationsLoading, setActivationsLoading] = useState(false);
  const [maxServers, setMaxServers] = useState(1);

  const loadActivations = useCallback(async () => {
    if (license.status === "none" || license.keyHint === " - ") {
      setActivations([]);
      return;
    }
    setActivationsLoading(true);
    try {
      const res = await fetch("/api/admin/license/activations");
      const data = (await res.json()) as {
        error?: string;
        activations?: LicenseActivationRow[];
        maxServers?: number;
      };
      if (!res.ok) throw new Error(data.error ?? "Could not load activations.");
      setActivations(data.activations ?? []);
      setMaxServers(data.maxServers ?? 1);
    } catch {
      setActivations([]);
    } finally {
      setActivationsLoading(false);
    }
  }, [license.status, license.keyHint]);

  useEffect(() => {
    void loadActivations();
  }, [loadActivations]);

  async function removeActivation(instanceId: string) {
    if (
      !confirm(
        `Remove activation for ${instanceId.slice(0, 8)}…? That server will lose Premium on next heartbeat.`,
      )
    ) {
      return;
    }
    setBusy("remove-activation");
    setError("");
    try {
      const res = await fetch("/api/admin/license/activations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Remove failed.");
      await loadActivations();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Remove failed.");
    } finally {
      setBusy("");
    }
  }

  function shortId(id: string) {
    if (id.length <= 12) return id;
    return `${id.slice(0, 8)}…${id.slice(-4)}`;
  }

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
        journalId?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      if (data.license) setLicense(data.license);
      setJournalId(data.journalId ?? "");
      if (action === "activate") setKey("");
      if (
        action === "activate" ||
        action === "deactivate" ||
        action === "heartbeat"
      ) {
        await loadActivations();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-6">
      {error && <Alert>{error}</Alert>}
      {license.verifyError && (
        <Alert>
          <strong>
            {license.trustMode === "heartbeat"
              ? "License heartbeat is stale."
              : "License token cannot be verified on this panel."}
          </strong>{" "}
          {license.verifyError}{" "}
          {license.trustMode === "heartbeat" ? (
            <>
              Premium features will reactivate as soon as the next heartbeat
              succeeds.
            </>
          ) : (
            <>
              Premium features will stay locked until the verifier is configured
              - see{" "}
              <a
                className="underline"
                href="https://github.com/macdirtycow/qadbak/blob/main/docs/COMMERCIAL.md#license-verification"
              >
                docs/COMMERCIAL.md
              </a>
              .
            </>
          )}
        </Alert>
      )}
      {journalId && (
        <Alert>
          Recorded in the action journal  - {" "}
          <a className="underline" href={`/admin/journal#${journalId}`}>
            view exact steps
          </a>
          .
        </Alert>
      )}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-medium text-white">Qadbak license</h2>
          <Link
            href="/admin/privacy"
            className="text-sm text-panel-link hover:underline"
          >
            Privacy &amp; data →
          </Link>
        </div>
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
            <dd className="text-white">{license.lastHeartbeatAt ?? " - "}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-sm text-panel-muted">Premium modules</dt>
            <dd className="text-white">
              {license.features.length
                ? license.features.join(", ")
                : "None (Core evaluation)"}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-panel-muted">Trust mode</dt>
            <dd className="text-white">
              {license.trustMode === "crypto" && license.verifyAlgo === "EdDSA"
                ? "Cryptographic - Ed25519 (config/license-public.pem)"
                : license.trustMode === "crypto" &&
                    license.verifyAlgo === "HS256"
                  ? "Cryptographic - HS256 (QADBAK_LICENSE_JWT_SECRET)"
                  : license.trustMode === "heartbeat"
                    ? `Heartbeat-based (license server is source of truth; grace = ${license.heartbeatGraceHours ?? 48}h)`
                    : " - "}
            </dd>
          </div>
          {license.trustMode === "heartbeat" ? (
            <div>
              <dt className="text-sm text-panel-muted">Heartbeat freshness</dt>
              <dd className="text-white">
                {license.heartbeatFresh
                  ? "Fresh - license is trusted"
                  : "Stale - Premium features are locked until next heartbeat"}
              </dd>
            </div>
          ) : null}
        </dl>
      </Card>

      <Card>
        <h3 className="font-medium text-white">Activate Premium</h3>
        <p className="mt-2 text-sm text-panel-muted">
          Enter your commercial license key from MacDirtyCow / Inveil. Premium
          modules unlock on this panel only while your key is active and
          heartbeat checks succeed.
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

      {license.keyHint !== " - " && license.status !== "none" ? (
        <Card>
          <h3 className="font-medium text-white">Other servers using this license</h3>
          <p className="mt-2 text-sm text-panel-muted">
            Up to {maxServers} server{maxServers === 1 ? "" : "s"} per license. Remove a
            dead VPS here to free a slot, then activate on the new machine.
          </p>
          {activationsLoading ? (
            <p className="mt-4 text-sm text-panel-muted">Loading activations…</p>
          ) : activations.length === 0 ? (
            <p className="mt-4 text-sm text-panel-muted">No activations recorded yet.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-panel-border text-panel-muted">
                    <th className="py-2 pr-4">Host</th>
                    <th className="py-2 pr-4">Fingerprint</th>
                    <th className="py-2 pr-4">Instance</th>
                    <th className="py-2 pr-4">First seen</th>
                    <th className="py-2 pr-4">Last heartbeat</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {activations.map((row) => (
                    <tr
                      key={row.instanceId}
                      className="border-b border-panel-border/60"
                    >
                      <td className="py-2 pr-4 text-white">
                        {row.hostnameHint}
                        {row.isCurrent ? (
                          <span className="ml-2 text-xs text-emerald-400">
                            (this server)
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs text-panel-muted">
                        {row.fingerprintTag ?? " - "}
                        {row.panelVersion ? ` · v${row.panelVersion}` : ""}
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs text-panel-muted">
                        {shortId(row.instanceId)}
                      </td>
                      <td className="py-2 pr-4 text-panel-muted">
                        {row.firstSeenAt
                          ? new Date(row.firstSeenAt).toLocaleString()
                          : " - "}
                      </td>
                      <td className="py-2 pr-4 text-panel-muted">
                        {row.lastHeartbeatAt
                          ? new Date(row.lastHeartbeatAt).toLocaleString()
                          : " - "}
                      </td>
                      <td className="py-2 pr-4 capitalize text-white">
                        {row.status}
                      </td>
                      <td className="py-2 text-right">
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={busy !== "" || row.isCurrent}
                          onClick={() => removeActivation(row.instanceId)}
                        >
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-3">
            <Button
              type="button"
              variant="ghost"
              disabled={busy !== "" || activationsLoading}
              onClick={() => loadActivations()}
            >
              Refresh list
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
