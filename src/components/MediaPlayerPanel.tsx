"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Card } from "@/components/ui";
import { formatBytes, type MediaVideoEntry } from "@/lib/media-library";

export function MediaPlayerPanel({ domain }: { domain: string }) {
  const enc = encodeURIComponent(domain);
  const [videos, setVideos] = useState<MediaVideoEntry[]>([]);
  const [selected, setSelected] = useState<MediaVideoEntry | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/domains/${enc}/media/videos`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load videos.");
      const list = (data.videos as MediaVideoEntry[]) ?? [];
      setVideos(list);
      setSelected((prev) => {
        if (prev && list.some((v) => v.path === prev.path)) return prev;
        return list[0] ?? null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
      setVideos([]);
      setSelected(null);
    } finally {
      setLoading(false);
    }
  }, [enc]);

  useEffect(() => {
    void load();
  }, [load]);

  const streamUrl = selected
    ? `/api/domains/${enc}/media/stream?path=${encodeURIComponent(selected.path)}`
    : "";

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-panel-accent">
            Quick player
          </p>
          <p className="mt-1 text-sm text-panel-muted">
            Play MP4/WebM files directly in the browser — no Jellyfin required. Best for a
            single film; use Jellyfin for libraries, apps, and transcoding.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-panel-border px-3 py-1.5 text-sm text-white hover:bg-panel-card"
        >
          Refresh list
        </button>
      </div>

      {error && (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-panel-muted">Loading videos…</p>
      ) : videos.length === 0 ? (
        <p className="mt-6 text-sm text-panel-muted">
          No videos found. Upload <code className="text-slate-300">.mp4</code> or{" "}
          <code className="text-slate-300">.webm</code> files to your media folder.
        </p>
      ) : (
        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,240px)_1fr]">
          <ul className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-panel-border p-2 lg:max-h-[420px]">
            {videos.map((video) => {
              const active = selected?.path === video.path;
              return (
                <li key={video.path}>
                  <button
                    type="button"
                    onClick={() => setSelected(video)}
                    className={`w-full rounded-md px-3 py-2 text-left text-sm transition ${
                      active
                        ? "bg-panel-accent/20 text-white"
                        : "text-panel-muted hover:bg-panel-card hover:text-white"
                    }`}
                  >
                    <span className="block truncate font-medium">{video.name}</span>
                    <span className="text-xs opacity-80">{formatBytes(video.sizeBytes)}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="min-w-0">
            {selected && (
              <>
                <p className="mb-2 truncate text-sm font-medium text-white">{selected.name}</p>
                <video
                  key={selected.path}
                  className="aspect-video w-full rounded-lg bg-black"
                  controls
                  playsInline
                  preload="metadata"
                  src={streamUrl}
                >
                  Your browser does not support HTML5 video for this file.
                </video>
              </>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
