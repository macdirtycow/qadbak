"use client";

import { Alert, Button, Card, Input } from "@/components/ui";
import { domainApiFetch, parseApiJson } from "@/lib/api-fetch";
import type { DomainFileEntry } from "@/lib/domain-files";
import { useEffect, useMemo, useState } from "react";

export function FileRenameDialog({
  open,
  domain,
  entry,
  onClose,
  onSuccess,
}: {
  open: boolean;
  domain: string;
  entry: DomainFileEntry | null;
  onClose: () => void;
  onSuccess: (destPath: string, message: string) => void;
}) {
  const enc = encodeURIComponent(domain);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [replaceExisting, setReplaceExisting] = useState(false);

  useEffect(() => {
    if (!open || !entry) return;
    setError("");
    setNewName(entry.name);
    setReplaceExisting(false);
  }, [open, entry]);

  const currentParent = useMemo(() => {
    if (!entry) return "";
    return entry.path.includes("/")
      ? entry.path.split("/").slice(0, -1).join("/")
      : "";
  }, [entry]);

  const sanitizedName = useMemo(
    () => newName.replace(/[/\\]/g, "").trim(),
    [newName],
  );

  const previewPath = useMemo(() => {
    if (!entry || !sanitizedName) return "";
    return currentParent ? `${currentParent}/${sanitizedName}` : sanitizedName;
  }, [entry, currentParent, sanitizedName]);

  const isNoop = !!entry && sanitizedName === entry.name;
  const canSubmit = !!entry && !!sanitizedName && !isNoop;

  if (!open || !entry) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!entry || !canSubmit) return;
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
          destDir: currentParent,
          newName: sanitizedName,
          overwrite: replaceExisting,
        }),
      });
      const data = await parseApiJson<{ error?: string; path?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Rename failed.");
      const destPath = String(data.path ?? previewPath);
      onSuccess(
        destPath,
        item.type === "dir"
          ? `Folder renamed to ${destPath}.`
          : `File renamed to ${destPath}.`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Rename failed.";
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
      aria-labelledby="rename-dialog-title"
    >
      <Card className="w-full max-w-lg">
        <h2 id="rename-dialog-title" className="text-lg font-medium text-white">
          Rename {entry.type === "dir" ? "folder" : "file"}
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
            <label className="mb-1 block text-sm text-panel-muted">New name</label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
              required
            />
          </div>

          {previewPath && !isNoop && (
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
            Replace existing item with this name if one already exists
          </label>

          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={loading || !canSubmit}>
              {loading ? "Renaming…" : "Rename"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
