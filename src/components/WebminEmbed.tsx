"use client";

import { Alert, Button, Card } from "@/components/ui";
import { useEffect, useState } from "react";

export function WebminEmbed({
  title,
  description,
  fetchUrl,
  height = "min(70vh, 720px)",
}: {
  title: string;
  description?: string;
  fetchUrl: string;
  height?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(fetchUrl);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not open module.");
      setUrl(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
      setUrl(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [fetchUrl]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium text-white">{title}</h2>
          {description && (
            <p className="mt-1 text-sm text-panel-muted">{description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={load} disabled={loading}>
            Refresh session
          </Button>
          {url && (
            <Button
              variant="ghost"
              onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
            >
              Open in new tab
            </Button>
          )}
        </div>
      </div>
      {error && <Alert>{error}</Alert>}
      <Card className="overflow-hidden p-0">
        {loading && (
          <p className="p-8 text-center text-sm text-panel-muted">Loading…</p>
        )}
        {!loading && url && (
          <iframe
            title={title}
            src={url}
            className="w-full border-0 bg-[#0f1419]"
            style={{ height }}
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
          />
        )}
        {!loading && !url && !error && (
          <p className="p-8 text-center text-sm text-panel-muted">No URL.</p>
        )}
      </Card>
    </div>
  );
}
