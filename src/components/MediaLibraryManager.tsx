"use client";

import Link from "next/link";
import { Alert, Button, Card, Input, Label } from "@/components/ui";
import { MediaPlayerPanel } from "@/components/MediaPlayerPanel";
import {
  formatBytes,
  quotaPercent,
  type MediaLibraryStatus,
} from "@/lib/media-library";
import { useDomainNavReset } from "@/hooks/useDomainNavReset";
import { useState } from "react";
import { DomainPageHeader } from "./DomainPageHeader";

function statusLabel(status?: string): { text: string; tone: string } {
  switch (status) {
    case "running":
      return { text: "Running", tone: "text-emerald-400" };
    case "exited":
    case "stopped":
      return { text: "Stopped", tone: "text-amber-400" };
    case "not_found":
      return { text: "Not found", tone: "text-panel-muted" };
    default:
      return { text: status || "Unknown", tone: "text-panel-muted" };
  }
}

export function MediaLibraryManager({
  domain,
  initialStatus,
  initialError,
  isAdmin,
}: {
  domain: string;
  initialStatus: MediaLibraryStatus;
  initialError: string;
  isAdmin: boolean;
}) {
  const enc = encodeURIComponent(domain);
  const parent = initialStatus.parentDomain ?? domain;
  const parentEnc = encodeURIComponent(parent);
  const filesDir = initialStatus.mediaPathRelative || "media";

  const [status, setStatus] = useState(initialStatus);
  const [pathInput, setPathInput] = useState(filesDir);
  const [error, setError] = useState(initialError);
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useDomainNavReset(domain, () => {
    setStatus(initialStatus);
    setPathInput(initialStatus.mediaPathRelative || "media");
    setError(initialError);
    setSuccess("");
  });

  const mediaUsed = status.mediaUsedBytes ?? 0;
  const homeUsed = status.homeUsedBytes ?? 0;
  const diskLimitMb = status.diskLimitMb ?? null;
  const pct = quotaPercent(homeUsed, diskLimitMb);
  const container = statusLabel(status.containerStatus);

  async function refresh() {
    const res = await fetch(`/api/domains/${enc}/media`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Could not refresh.");
    setStatus(data as MediaLibraryStatus);
    setPathInput(String(data.mediaPathRelative ?? "media"));
  }

  async function savePath(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdmin) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/domains/${enc}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaPath: pathInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed.");
      setStatus(data as MediaLibraryStatus);
      setSuccess(String(data.message ?? "Media folder updated."));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <DomainPageHeader domain={domain} title="Media library" />
      {error && <Alert>{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {!status.installed && (
        <Card className="border-amber-500/30 bg-amber-500/5 p-5">
          <p className="font-medium text-white">Jellyfin not installed yet</p>
          <p className="mt-2 text-sm text-panel-muted">
            Choose your upload folder below, then install Jellyfin from the App store to
            stream at <code className="text-slate-300">media.{parent}</code>.
          </p>
          {isAdmin && (
            <Link
              href="/admin/apps/jellyfin/install"
              className="mt-4 inline-flex rounded-lg bg-panel-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Install Jellyfin
            </Link>
          )}
        </Card>
      )}

      {status.installed && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="p-5">
            <p className="text-xs uppercase tracking-wide text-panel-muted">Jellyfin</p>
            <p className={`mt-2 text-lg font-semibold ${container.tone}`}>{container.text}</p>
            {status.adminUrl && (
              <a
                href={status.adminUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex text-sm text-panel-accent hover:underline"
              >
                Open {status.subdomain ?? "media server"} →
              </a>
            )}
          </Card>
          <Card className="p-5">
            <p className="text-xs uppercase tracking-wide text-panel-muted">Media folder</p>
            <p className="mt-2 text-lg font-semibold text-white">
              {formatBytes(mediaUsed)}
            </p>
            <p className="mt-1 text-sm text-panel-muted">
              {status.mediaFileCount ?? 0} files
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-xs uppercase tracking-wide text-panel-muted">Account disk</p>
            <p className="mt-2 text-lg font-semibold text-white">
              {formatBytes(homeUsed)}
              {diskLimitMb ? ` / ${diskLimitMb} MB` : ""}
            </p>
            {pct !== null && (
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-panel-border">
                <div
                  className="h-full rounded-full bg-panel-accent"
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
            {!diskLimitMb && isAdmin && (
              <Link
                href={`/domains/${parentEnc}/limits`}
                className="mt-2 inline-flex text-xs text-panel-accent hover:underline"
              >
                Set disk limit
              </Link>
            )}
          </Card>
        </div>
      )}

      <Card className="p-5">
        <form onSubmit={savePath} className="space-y-4">
          <div>
            <Label htmlFor="media-path">Upload folder (inside home)</Label>
            <Input
              id="media-path"
              value={pathInput}
              onChange={(e) => setPathInput(e.target.value)}
              placeholder="media"
              disabled={!isAdmin || loading}
            />
            <p className="mt-2 text-xs text-panel-muted">
              Relative to the domain home, e.g. <code className="text-slate-300">media</code> or{" "}
              <code className="text-slate-300">private/films</code>. Jellyfin mounts this as{" "}
              <code className="text-slate-300">/media</code> inside the container.
            </p>
            {status.mediaPath && (
              <p className="mt-1 text-xs text-panel-muted">
                Server path: <code className="text-slate-300">{status.mediaPath}</code>
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            {isAdmin && (
              <Button type="submit" disabled={loading}>
                {loading ? "Saving…" : "Save folder"}
              </Button>
            )}
            <Button type="button" variant="secondary" onClick={() => refresh().catch((e) => setError(e.message))}>
              Refresh
            </Button>
            <Link
              href={`/domains/${parentEnc}/files?dir=${encodeURIComponent(filesDir)}`}
              className="inline-flex items-center rounded-lg border border-panel-border px-4 py-2 text-sm text-white hover:bg-panel-card"
            >
              Upload via Files
            </Link>
          </div>
        </form>
      </Card>

      <MediaPlayerPanel domain={domain} />

      <Card className="p-5 text-sm text-panel-muted">
        <p className="font-medium text-white">Legal note</p>
        <p className="mt-2">
          Only store media you own or have rights to use. Qadbak provides the server;
          you are responsible for the content you upload.
        </p>
      </Card>
    </div>
  );
}
