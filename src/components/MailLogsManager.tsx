"use client";

import { Alert, Button, Card, Input } from "@/components/ui";
import { useState } from "react";
import { DomainPageHeader } from "./DomainPageHeader";

export function MailLogsManager({
  domain,
  initialLines,
  initialError,
  isAdmin,
}: {
  domain: string;
  initialLines: string[];
  initialError: string;
  isAdmin: boolean;
}) {
  const enc = encodeURIComponent(domain);
  const [lines, setLines] = useState(initialLines);
  const [query, setQuery] = useState("");
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(false);

  async function search() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/domains/${enc}/mail-logs?q=${encodeURIComponent(query)}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Search failed.");
      setLines(data.lines ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <DomainPageHeader domain={domain} title="Mail logs" />
      {error && <Alert>{error}</Alert>}
      <Card>
        <div className="flex gap-2">
          <Input
            className="flex-1"
            placeholder="Search term (regex)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Button onClick={search} disabled={loading}>
            Search
          </Button>
        </div>
        <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap font-mono text-xs text-slate-300">
          {lines.length ? lines.join("\n") : "No lines."}
        </pre>
      </Card>
      {isAdmin && (
        <Alert variant="info">
          Resend requires a message id from the logs — use your mail queue on the server for
          advanced mail queue actions.
        </Alert>
      )}
    </div>
  );
}
