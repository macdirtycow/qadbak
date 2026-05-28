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
import { useMemo, useRef, useState } from "react";
import { DomainPageHeader } from "./DomainPageHeader";

export function BackupsManager({
  domain,
  initialScheduled,
  canBackup,
  canRestore,
  canUpload = false,
  initialError,
  nativeMode = false,
  isAdmin = false,
  canPartialRestore = false,
}: {
  domain: string;
  initialScheduled: ScheduledBackup[];
  canBackup: boolean;
  canRestore: boolean;
  /** Admin + native backups: show upload UI */
  canUpload?: boolean;
  initialError: string;
  nativeMode?: boolean;
  isAdmin?: boolean;
  /** Browse archive + restore single file under public_html */
  canPartialRestore?: boolean;
}) {
  const router = useRouter();
  const enc = encodeURIComponent(domain);

  function downloadUrl(backupName: string) {
    return `/api/domains/${enc}/backups/download?name=${encodeURIComponent(backupName)}`;
  }
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
  const [uploadName, setUploadName] = useState("");
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [browseArchive, setBrowseArchive] = useState("");
  const [browsePrefix, setBrowsePrefix] = useState("");
  const [browseEntries, setBrowseEntries] = useState<{ path: string; name: string; type: string }[]>([]);
  const [partialPath, setPartialPath] = useState("");
  const [offsiteEnabled, setOffsiteEnabled] = useState(false);
  const [providerId, setProviderId] = useState("default");

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

  async function loadOffsitePolicy() {
    if (!nativeMode || !isAdmin) return;
    const res = await fetch(`/api/domains/${enc}/backups/policy`);
    const data = await res.json();
    if (res.ok && data.policy) {
      setOffsiteEnabled(Boolean(data.policy.offsite));
      setProviderId(String(data.policy.providerId ?? "default"));
    }
  }

  async function saveOffsitePolicy() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/domains/${enc}/backups/policy`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offsite: offsiteEnabled, providerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setSuccess("Offsite backup policy saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  async function browseArchiveList() {
    if (!browseArchive.trim()) return;
    setLoading(true);
    setError("");
    try {
      const q = new URLSearchParams({
        name: browseArchive.trim(),
        prefix: browsePrefix.trim(),
      });
      const res = await fetch(`/api/domains/${enc}/backups/archive?${q}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Browse failed");
      setBrowseEntries(data.entries ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  async function restorePartialFile() {
    if (!browseArchive.trim() || !partialPath.trim()) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/domains/${enc}/backups/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "restore-file",
          name: browseArchive.trim(),
          path: partialPath.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Restore failed");
      setSuccess(`Restored ${data.restored ?? partialPath}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
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

  async function uploadBackup(file: File) {
    if (!file.name.toLowerCase().endsWith(".tar.gz")) {
      setError("Only .tar.gz backup archives are supported.");
      return;
    }
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const form = new FormData();
      form.append("file", file);
      if (uploadName.trim()) form.append("name", uploadName.trim());
      const res = await fetch(`/api/domains/${enc}/backups/upload`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");
      const r = data.result as { file?: string; sizeBytes?: number } | undefined;
      const mb =
        r?.sizeBytes && r.sizeBytes > 0
          ? ` (${(r.sizeBytes / 1024 / 1024).toFixed(1)} MB)`
          : "";
      setSuccess(`Backup uploaded: ${r?.file ?? file.name}${mb}`);
      setUploadName("");
      if (uploadInputRef.current) uploadInputRef.current.value = "";
      if (data.scheduled) setScheduled(data.scheduled);
      else await refreshList();
      router.refresh();
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
      const r = data.result as {
        restored?: string[];
        preview?: string[];
        entries?: number;
        mailAccounts?: { user?: string; email?: string }[];
        components?: string[];
        settingsFiles?: string[];
      } | undefined;
      if (restoreTest && r?.preview?.length) {
        const mailN = r.mailAccounts?.length ?? 0;
        const comps = r.components?.length ? ` · ${r.components.join(", ")}` : "";
        const mailHint = mailN > 0 ? ` · ${mailN} mail account(s)` : "";
        const settingsHint = r.settingsFiles?.length
          ? ` · settings: ${r.settingsFiles.map((f) => f.replace(/\.json$/, "")).join(", ")}`
          : "";
        setSuccess(
          `Test OK — ${r.entries ?? r.preview.length} paths in archive${mailHint}${settingsHint}${comps}.`,
        );
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
            ? "Full backups in ~/backups: website, all mail accounts, panel settings (mail, DNS, PHP, SSL, aliases, …), BIND zone, SSL certificates, crontab, MySQL, and mail routing maps."
            : undefined
        }
      />
      {error && <Alert>{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {nativeMode && isAdmin && (
        <Card>
          <h2 className="text-lg font-medium text-white">Offsite backup (S3 / B2)</h2>
          <p className="mt-2 text-sm text-panel-muted">
            After each backup, upload to configured provider (Admin → Cloud).
          </p>
          <label className="mt-4 flex items-center gap-2 text-sm text-panel-muted">
            <input
              type="checkbox"
              checked={offsiteEnabled}
              onChange={(e) => setOffsiteEnabled(e.target.checked)}
            />
            Upload backups offsite
          </label>
          <div className="mt-3">
            <Label htmlFor="provider-id">Provider ID</Label>
            <Input
              id="provider-id"
              className="mt-1 max-w-xs"
              value={providerId}
              onChange={(e) => setProviderId(e.target.value)}
            />
          </div>
          <div className="mt-4 flex gap-2">
            <Button variant="secondary" disabled={loading} onClick={saveOffsitePolicy}>
              Save offsite policy
            </Button>
            <Button variant="ghost" disabled={loading} onClick={loadOffsitePolicy}>
              Reload policy
            </Button>
          </div>
        </Card>
      )}

      {nativeMode && canPartialRestore && (
        <Card>
          <h2 className="text-lg font-medium text-white">Granular restore</h2>
          <p className="mt-2 text-sm text-panel-muted">
            Browse a backup and restore one file under public_html/.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="browse-archive">Archive</Label>
              <Input
                id="browse-archive"
                className="mt-1"
                value={browseArchive}
                onChange={(e) => setBrowseArchive(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="browse-prefix">Prefix</Label>
              <Input
                id="browse-prefix"
                className="mt-1"
                placeholder="public_html"
                value={browsePrefix}
                onChange={(e) => setBrowsePrefix(e.target.value)}
              />
            </div>
          </div>
          <Button className="mt-3" variant="secondary" disabled={loading} onClick={browseArchiveList}>
            List contents
          </Button>
          {browseEntries.length > 0 && (
            <ul className="mt-4 max-h-40 overflow-auto text-sm text-panel-muted divide-y divide-panel-border">
              {browseEntries.map((e) => (
                <li key={e.path} className="py-1">
                  <button
                    type="button"
                    className="hover:text-white"
                    onClick={() => setPartialPath(e.path)}
                  >
                    {e.path}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3">
            <Label htmlFor="partial-path">Path to restore</Label>
            <Input
              id="partial-path"
              className="mt-1"
              value={partialPath}
              onChange={(e) => setPartialPath(e.target.value)}
            />
          </div>
          <Button
            className="mt-3"
            variant="danger"
            disabled={loading || !partialPath.startsWith("public_html/")}
            onClick={restorePartialFile}
          >
            Restore file only
          </Button>
        </Card>
      )}

      {canBackup && (
        <div className="flex flex-wrap justify-end gap-2">
          {canUpload && (
            <>
              <input
                ref={uploadInputRef}
                type="file"
                accept=".tar.gz,application/gzip,application/x-gzip"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadBackup(file);
                  e.target.value = "";
                }}
              />
              <Button
                variant="secondary"
                disabled={loading}
                onClick={() => uploadInputRef.current?.click()}
              >
                {loading ? "Working…" : "Upload backup"}
              </Button>
            </>
          )}
          <Button onClick={startBackup} disabled={loading}>
            {loading ? "Working…" : "Back up now"}
          </Button>
        </div>
      )}

      {canUpload && (
        <Card>
          <h2 className="text-lg font-medium text-white">Upload backup</h2>
          <p className="mt-2 text-sm text-panel-muted">
            Import a .tar.gz archive into ~/backups (from a download or another server). Then use
            Restore below.
          </p>
          <div className="mt-4 max-w-xl">
            <Label htmlFor="upload-name">Filename on server (optional)</Label>
            <Input
              id="upload-name"
              className="mt-1 font-mono text-sm"
              placeholder={`${domain}-uploaded-….tar.gz`}
              value={uploadName}
              onChange={(e) => setUploadName(e.target.value)}
            />
          </div>
        </Card>
      )}

      {nativeMode && canRestore && (
        <Card>
          <h2 className="text-lg font-medium text-white">Automatic schedule</h2>
          <p className="mt-1 text-sm text-panel-muted">
            Cron on the domain unix user. Each run includes the website, all mailboxes,
            panel settings, DNS zone, SSL certs, crontab, MySQL, and Postfix routing snapshot.
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
                  {nativeMode && canBackup && (
                    <a
                      href={downloadUrl(s.id)}
                      download
                      className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium text-panel-muted transition hover:bg-panel-card hover:text-white ${loading ? "pointer-events-none opacity-50" : ""}`}
                    >
                      Download
                    </a>
                  )}
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
              ? "Filename from ~/backups. Test shows manifest and mail paths without writing data."
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
