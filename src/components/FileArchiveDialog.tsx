"use client";

import { Alert, Button, Card, Input } from "@/components/ui";
import { domainApiFetch, parseApiJson } from "@/lib/api-fetch";
import type { ArchiveFormat } from "@/lib/domain-files-archives";
import {
  archiveFormatLabel,
  defaultArchiveOutputName,
  defaultExtractFolderName,
} from "@/lib/domain-files-archives";
import type { DomainFileEntry } from "@/lib/domain-files";
import { useEffect, useMemo, useState } from "react";

type Mode = "extract" | "compress";

export function FileArchiveDialog({
  open,
  mode,
  domain,
  cwd,
  archiveEntry,
  entries,
  onClose,
  onSuccess,
}: {
  open: boolean;
  mode: Mode;
  domain: string;
  cwd: string;
  archiveEntry?: DomainFileEntry;
  entries: DomainFileEntry[];
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [destFolder, setDestFolder] = useState("");
  const [format, setFormat] = useState<ArchiveFormat>("zip");
  const [outputName, setOutputName] = useState("");
  const [scope, setScope] = useState<"folder" | "selected">("folder");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const selectable = useMemo(
    () =>
      entries.filter((e) => {
        if (e.name.startsWith(".")) return false;
        if (e.type === "file" && e.archive) return false;
        return true;
      }),
    [entries],
  );

  useEffect(() => {
    if (!open) return;
    setError("");
    if (mode === "extract" && archiveEntry) {
      setDestFolder(defaultExtractFolderName(archiveEntry.name));
    }
    if (mode === "compress") {
      setFormat("zip");
      setOutputName(defaultArchiveOutputName(cwd, "zip"));
      setScope("folder");
      setSelected(new Set());
    }
  }, [open, mode, archiveEntry, cwd]);

  useEffect(() => {
    if (mode === "compress" && open) {
      setOutputName(defaultArchiveOutputName(cwd, format));
    }
  }, [format, cwd, mode, open]);

  if (!open) return null;

  function toggleSelected(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  async function submit() {
    setLoading(true);
    setError("");
    try {
      if (mode === "extract") {
        if (!archiveEntry) throw new Error("No archive selected.");
        const parent = archiveEntry.path.replace(/\/[^/]+$/, "");
        const destDir = destFolder.trim()
          ? parent
            ? `${parent}/${destFolder.trim().replace(/^\/+/, "")}`
            : destFolder.trim().replace(/^\/+/, "")
          : "";
        const res = await domainApiFetch(domain, "/files", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "extract-archive",
            path: archiveEntry.path,
            destDir,
          }),
        });
        const data = await parseApiJson<{ error?: string; destDir?: string }>(res);
        if (!res.ok) throw new Error(data.error ?? "Extract failed.");
        onSuccess(
          `Extracted ${archiveFormatLabel(archiveEntry.archiveFormat)} to ${data.destDir ?? destFolder}.`,
        );
        onClose();
        return;
      }

      const items =
        scope === "selected" ? [...selected] : [];
      const res = await domainApiFetch(domain, "/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-archive",
          parent: cwd,
          format,
          name: outputName.trim(),
          items,
        }),
      });
      const data = await parseApiJson<{
        error?: string;
        path?: string;
        sizeBytes?: number;
      }>(res);
      if (!res.ok) throw new Error(data.error ?? "Compress failed.");
      onSuccess(`Created ${data.path} (${formatBytes(data.sizeBytes)}).`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
    >
      <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {mode === "extract" ? "Extract archive" : "Compress files"}
            </h2>
            <p className="mt-1 text-sm text-panel-muted">
              {mode === "extract"
                ? `Unpack ${archiveEntry?.name ?? "archive"} into a folder in this directory.`
                : `Create a ZIP or TAR.GZ in ${cwd || "home"}.`}
            </p>
          </div>
          <Button variant="ghost" className="!px-2" onClick={onClose} aria-label="Close">
            ×
          </Button>
        </div>

        {error && (
          <div className="mt-4">
            <Alert>{error}</Alert>
          </div>
        )}

        <div className="mt-4 space-y-4">
          {mode === "extract" && archiveEntry && (
            <>
              <div className="rounded-lg border border-panel-border bg-panel-bg/50 px-3 py-2 text-sm">
                <span className="text-panel-muted">Archive</span>
                <p className="font-medium text-white">{archiveEntry.name}</p>
                <p className="text-xs text-panel-muted">
                  {archiveFormatLabel(archiveEntry.archiveFormat)} · {archiveEntry.size ?? " - "}
                </p>
              </div>
              <label className="block text-sm">
                <span className="text-panel-muted">Extract to folder (name)</span>
                <Input
                  className="mt-1"
                  value={destFolder}
                  onChange={(e) => setDestFolder(e.target.value)}
                  placeholder="e.g. extracted-site"
                />
                <span className="mt-1 block text-xs text-panel-muted">
                  Created next to the archive in the current directory.
                </span>
              </label>
            </>
          )}

          {mode === "compress" && (
            <>
              <div className="flex gap-2">
                {(["zip", "tar.gz"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFormat(f)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                      format === f
                        ? "border-panel-accent bg-panel-accent/15 text-white"
                        : "border-panel-border text-panel-muted hover:border-panel-muted"
                    }`}
                  >
                    {f === "zip" ? "ZIP" : "TAR.GZ"}
                  </button>
                ))}
              </div>
              <label className="block text-sm">
                <span className="text-panel-muted">Output file name</span>
                <Input
                  className="mt-1"
                  value={outputName}
                  onChange={(e) => setOutputName(e.target.value)}
                  required
                />
              </label>
              <div className="space-y-2">
                <span className="text-sm text-panel-muted">Include</span>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-white">
                  <input
                    type="radio"
                    name="compress-scope"
                    checked={scope === "folder"}
                    onChange={() => setScope("folder")}
                  />
                  Everything in this folder (except the new archive)
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-white">
                  <input
                    type="radio"
                    name="compress-scope"
                    checked={scope === "selected"}
                    onChange={() => setScope("selected")}
                  />
                  Selected items only
                </label>
              </div>
              {scope === "selected" && (
                <div className="max-h-40 overflow-y-auto rounded-lg border border-panel-border p-2">
                  {selectable.length === 0 ? (
                    <p className="text-xs text-panel-muted">No items to select.</p>
                  ) : (
                    selectable.map((e) => (
                      <label
                        key={e.path}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-panel-bg/60"
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(e.name)}
                          onChange={() => toggleSelected(e.name)}
                        />
                        <span className="text-xs uppercase text-panel-muted">
                          {e.type}
                        </span>
                        <span className="text-white">{e.name}</span>
                      </label>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={
              loading ||
              (mode === "compress" &&
                scope === "selected" &&
                selected.size === 0)
            }
          >
            {loading
              ? "Working…"
              : mode === "extract"
                ? "Extract"
                : "Create archive"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function formatBytes(n: number | undefined): string {
  if (!n || n < 1) return "0 B";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
