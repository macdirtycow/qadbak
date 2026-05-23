"use client";

import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Input,
  Label,
} from "@/components/ui";
import type { ScheduledBackup } from "@/lib/provisioner";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { DomainPageHeader } from "./DomainPageHeader";

export function BackupsManager({
  domain,
  initialScheduled,
  canBackup,
  canRestore,
  initialError,
  nativeMode = false,
}: {
  domain: string;
  initialScheduled: ScheduledBackup[];
  canBackup: boolean;
  canRestore: boolean;
  initialError: string;
  nativeMode?: boolean;
}) {
  const router = useRouter();
  const enc = encodeURIComponent(domain);
  const [scheduled, setScheduled] = useState(initialScheduled);
  const [error, setError] = useState(initialError);
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [restoreSource, setRestoreSource] = useState("");
  const [restoreTest, setRestoreTest] = useState(true);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [confirmTyped, setConfirmTyped] = useState("");
  const [cronSchedule, setCronSchedule] = useState("0 3 * * *");
  const [retainCount, setRetainCount] = useState(7);

  const scheduleRow = useMemo(
    () => scheduled.find((s) => s.id === "schedule"),
    [scheduled],
  );
  const archiveRows = useMemo(
    () => scheduled.filter((s) => s.id !== "schedule"),
    [scheduled],
  );

  async function refreshList() {
    const res = await fetch(`/api/domains/${enc}/backups`);
    const data = await res.json();
    if (res.ok) setScheduled(data.scheduled ?? []);
  }

  async function startBackup() {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/domains/${enc}/backups`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Backup failed.");
      const r = data.result as { file?: string; components?: string[] } | undefined;
      const parts = r?.components?.length ? ` (${r.components.join(", ")})` : "";
      setSuccess(
        nativeMode
          ? `Backup created: ${r?.file ?? "OK"}${parts}`
          : "Backup started. Progress appears in the panel when complete.",
      );
      await refreshList();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleLegacyRow(id: string, enabled: boolean) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/domains/${enc}/backups`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, enabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed.");
      setScheduled(data.scheduled ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleSchedule(enabled: boolean) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/domains/${enc}/backups`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "schedule", enabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed.");
      setScheduled(data.scheduled ?? []);
      setSuccess(enabled ? "Automatic backups enabled." : "Automatic backups disabled.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  async function saveSchedule() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/domains/${enc}/backups`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "schedule",
          enabled: scheduleRow?.enabled === "1",
          schedule: cronSchedule,
          retain: retainCount,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed.");
      setScheduled(data.scheduled ?? []);
      setSuccess("Backup schedule saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteBackup(name: string) {
    if (!confirm(`Delete backup ${name}?`)) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/domains/${enc}/backups`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed.");
      setScheduled(data.scheduled ?? []);
      setSuccess(`Deleted ${name}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  async function runRestore() {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/domains/${enc}/backups/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: restoreSource, test: restoreTest }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Restore failed.");
      const r = data.result as { restored?: string[]; preview?: string[] } | undefined;
      if (restoreTest && r?.preview?.length) {
        setSuccess(`Test OK — ${r.preview.length} entries (first files listed in logs).`);
      } else if (r?.restored?.length) {
        setSuccess(`Restored: ${r.restored.join(", ")}`);
      } else {
        setSuccess(
          restoreTest
            ? "Test restore completed."
            : nativeMode
              ? "Restore completed."
              : "Restore started. Progress appears in the panel when complete.",
        );
      }
      setShowRestoreConfirm(false);
      setConfirmTyped("");
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
        title="Backups"
        description={
          nativeMode
            ? "Qadbak backups: website, mail, databases, and panel config in ~/backups"
            : undefined
        }
      />
      {error && <Alert>{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {canBackup && (
        <div className="flex justify-end">
          <Button onClick={startBackup} disabled={loading}>
            {loading ? "Working…" : "Back up now"}
          </Button>
        </div>
      )}

      {nativeMode && canRestore && (
        <Card>
          <h2 className="text-lg font-medium text-white">Automatic schedule</h2>
          <p className="mt-1 text-sm text-panel-muted">
            Cron on the domain unix user. Backups include public_html, Maildir, MySQL dumps,
            and Qadbak domain config.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="cron-schedule">Cron schedule</Label>
              <Input
                id="cron-schedule"
                className="mt-1 font-mono text-sm"
                value={cronSchedule}
                onChange={(e) => setCronSchedule(e.target.value)}
                placeholder="0 3 * * *"
              />
            </div>
            <div>
              <Label htmlFor="retain">Keep last N backups</Label>
              <Input
                id="retain"
                type="number"
                min={1}
                max={90}
                className="mt-1"
                value={retainCount}
                onChange={(e) => setRetainCount(Number(e.target.value) || 7)}
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" disabled={loading} onClick={saveSchedule}>
              Save schedule
            </Button>
            {scheduleRow && (
              <Button
                variant="ghost"
                disabled={loading}
                onClick={() => toggleSchedule(scheduleRow.enabled !== "1")}
              >
                {scheduleRow.enabled === "1" ? "Disable automatic" : "Enable automatic"}
              </Button>
            )}
            {scheduleRow && (
              <Badge tone={scheduleRow.enabled === "1" ? "success" : "warning"}>
                {scheduleRow.enabled === "1" ? "Automatic on" : "Automatic off"}
              </Badge>
            )}
          </div>
        </Card>
      )}

      <Card>
        <h2 className="text-lg font-medium text-white">
          {nativeMode ? "Backup archives" : "Scheduled backups"}
        </h2>
        {archiveRows.length === 0 ? (
          <p className="mt-4 text-sm text-panel-muted">
            {nativeMode
              ? "No backups yet. Use Back up now or enable the automatic schedule."
              : "No schedule configured."}
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-panel-border">
            {archiveRows.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-white">{s.schedule ?? "Backup"}</p>
                  <p className="text-sm text-panel-muted">{s.dest ?? s.id}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {nativeMode && canRestore && (
                    <Button
                      variant="ghost"
                      disabled={loading}
                      onClick={() => setRestoreSource(s.id)}
                    >
                      Use for restore
                    </Button>
                  )}
                  {nativeMode && canBackup && (
                    <Button
                      variant="secondary"
                      disabled={loading}
                      onClick={() => deleteBackup(s.id)}
                    >
                      Delete
                    </Button>
                  )}
                  {!nativeMode && canBackup && s.id !== "schedule" && (
                    <Button
                      variant="secondary"
                      disabled={loading}
                      onClick={() => toggleLegacyRow(s.id, s.enabled !== "1")}
                    >
                      {s.enabled === "1" ? "Turn off" : "Turn on"}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {canRestore && (
        <Card>
          <h2 className="text-lg font-medium text-white">Restore</h2>
          <p className="mt-2 text-sm text-panel-muted">
            {nativeMode
              ? "Filename from the list above (in ~/backups). Test lists archive contents without writing."
              : "Local path or cloud URL (e.g. s3://…). Run a test restore first."}
          </p>
          <div className="mt-4 space-y-3">
            <div>
              <Label htmlFor="restore-source">Source</Label>
              <Input
                id="restore-source"
                className="mt-1"
                placeholder={
                  nativeMode ? "example.com-manual-2026-05-20.tar.gz" : "/backup/example.com.tgz"
                }
                value={restoreSource}
                onChange={(e) => setRestoreSource(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-panel-muted">
              <input
                type="checkbox"
                checked={restoreTest}
                onChange={(e) => setRestoreTest(e.target.checked)}
              />
              Test only (list contents / no changes)
            </label>
            <Button
              variant="danger"
              disabled={loading || !restoreSource.trim()}
              onClick={() => setShowRestoreConfirm(true)}
            >
              {restoreTest ? "Test archive" : "Restore"}
            </Button>
          </div>
        </Card>
      )}

      {!canBackup && (
        <Alert variant="info">
          You can view backups. Ask an administrator to create or restore backups.
        </Alert>
      )}

      <ConfirmDialog
        open={showRestoreConfirm}
        title="Confirm restore"
        description={
          restoreTest
            ? `Test restore for ${domain} from ${restoreSource}?`
            : `WARNING: restore overwrites data for ${domain}. Source: ${restoreSource}`
        }
        confirmLabel={restoreTest ? "Run test" : "Run restore"}
        confirmValue={domain}
        typedValue={confirmTyped}
        onTypedChange={setConfirmTyped}
        onConfirm={runRestore}
        onCancel={() => {
          setShowRestoreConfirm(false);
          setConfirmTyped("");
        }}
        loading={loading}
      />
    </div>
  );
}
