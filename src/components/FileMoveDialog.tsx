"use client";

import { Alert, Button, Card, Input } from "@/components/ui";
import { domainApiFetch, parseApiJson } from "@/lib/api-fetch";
import { DOMAIN_FILE_QUICK_PATHS, resolveMoveDestination } from "@/lib/domain-files";
import type { DomainFileEntry } from "@/lib/domain-files";
import { useEffect, useMemo, useState } from "react";

export function FileMoveDialog({
  open,
  domain,
  cwd,
  entry,
  onClose,
  onSuccess,
}: {
  open: boolean;
  domain: string;
  cwd: string;
  entry: DomainFileEntry | null;
  onClose: () => void;
  onSuccess: (destPath: string, message: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [destDir, setDestDir] = useState("");
  const [newName, setNewName] = useState("");
  const [replaceExisting, setReplaceExisting] = useState(false);

  useEffect(() => {
    if (!open || !entry) return;
    setError("");
    setDestDir(cwd);
    setNewName(entry.name);
    setReplaceExisting(false);
  }, [open, entry, cwd]);

  const previewPath = useMemo(() => {
    if (!entry) return "";
    try {
      return resolveMoveDestination(entry.path, destDir, newName);
    } catch {
      return "";
    }
  }, [entry, destDir, newName]);

  if (!open || !entry) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!entry) return;
    const item = entry;
    setLoading(true);
    setError("");
    try {
      const res = await domainApiFetch(domain, "/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "move",
          path: item.path,
          destDir,
          newName: newName.trim() || item.name,
          overwrite: replaceExisting,
        }),
      });
      const data = await parseApiJson<{ error?: string; path?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Move failed.");
      const destPath = String(data.path ?? previewPath);
      onSuccess(
        destPath,
        item.type === "dir"
          ? `Folder moved to ${destPath}.`
          : `File moved to ${destPath}.`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Move failed.";
      setError(msg);
      if (/already exists|Enable replace/i.test(msg)) setReplaceExisting(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="move-dialog-title"
    >
      <Card className="w-full max-w-lg">
        <h2 id="move-dialog-title" className="text-lg font-medium text-white">
          Move {entry.type === "dir" ? "folder" : "file"}
        </h2>
        <p className="mt-1 text-sm text-panel-muted">
          <span className="font-mono text-white/90">{entry.path}</span>
        </p>

        {error && (
          <div className="mt-4">
            <Alert>{error}</Alert>
          </div>
        )}

        <form onSubmit={submit} className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-sm text-panel-muted">Destination folder</label>
            <Input
              value={destDir}
              onChange={(e) => setDestDir(e.target.value)}
              placeholder="e.g. public_html or public_html/backups"
              required
            />
            <p className="mt-1 text-xs text-panel-muted">
              Path relative to home. The folder must already exist.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                className="!px-2 !py-1 text-xs"
                onClick={() => setDestDir("")}
              >
                Home
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="!px-2 !py-1 text-xs"
                onClick={() => setDestDir(cwd)}
              >
                Current folder
              </Button>
              {DOMAIN_FILE_QUICK_PATHS.map((q) => (
                <Button
                  key={q.id}
                  type="button"
                  variant="ghost"
                  className="!px-2 !py-1 text-xs"
                  onClick={() => setDestDir(q.id)}
                >
                  {q.label}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm text-panel-muted">Name in destination</label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
            />
          </div>

          {previewPath && (
            <p className="text-sm text-panel-muted">
              New path: <span className="font-mono text-white/90">{previewPath}</span>
            </p>
          )}

          <label className="flex cursor-pointer items-center gap-2 text-sm text-panel-muted">
            <input
              type="checkbox"
              checked={replaceExisting}
              onChange={(e) => setReplaceExisting(e.target.checked)}
            />
            Replace existing item at destination if the name already exists
          </label>

          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={loading || !previewPath}>
              {loading ? "Moving…" : "Move"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
