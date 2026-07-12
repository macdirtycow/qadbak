"use client";

import { Alert, Button, Card } from "@/components/ui";
import { useState } from "react";

export function ServerConfigButton() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function check() {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/server/check-config");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Check failed.");
      setMessage(data.message ?? "OK");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <h2 className="text-lg font-medium text-white">Server configuration</h2>
      <p className="mt-1 text-sm text-panel-muted">
        Native stack check - nginx, mail, database services (administrators only)
      </p>
      <Button className="mt-4" variant="secondary" onClick={check} disabled={loading}>
        {loading ? "Working…" : "Check configuration"}
      </Button>
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      {message && (
        <pre className="mt-3 max-h-48 overflow-auto rounded bg-panel-bg p-3 text-xs text-slate-300">
          {message}
        </pre>
      )}
    </Card>
  );
}
