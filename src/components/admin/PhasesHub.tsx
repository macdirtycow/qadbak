"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Button, Card } from "@/components/ui";
import type { PhaseDefinition } from "@/lib/phases/catalog";

type PhaseCheck = {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
};

type PhaseStatus = {
  phase: number;
  score: number;
  checks: PhaseCheck[];
  ready: boolean;
};

type PhasesResponse = {
  definitions: PhaseDefinition[];
  phases: PhaseStatus[];
  overallPercent: number;
  readyCount: number;
  error?: string;
};

export function PhasesHub({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<PhasesResponse | null>(null);
  const [open, setOpen] = useState<number | null>(compact ? null : 1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/phases");
      const json = (await res.json()) as PhasesResponse;
      if (!res.ok) throw new Error(json.error ?? "Load failed");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return <p className="text-sm text-panel-muted">Fasen laden…</p>;
  }

  if (!data) {
    return error ? <Alert>{error}</Alert> : null;
  }

  const statusByPhase = new Map(data.phases.map((p) => [p.phase, p]));

  if (compact) {
    return (
      <Card className="border-panel-accent/30 bg-panel-accent/5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-panel-accent">
              8 fasen roadmap
            </p>
            <p className="mt-1 text-white">
              {data.readyCount}/8 klaar · {data.overallPercent}% gemiddeld
            </p>
          </div>
          <Link
            href="/admin/phases"
            className="text-sm text-panel-link hover:underline"
          >
            Open fase-hub →
          </Link>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {data.definitions.map((d) => {
            const st = statusByPhase.get(d.id);
            return (
              <span
                key={d.id}
                title={d.title}
                className={`rounded px-2 py-1 text-xs ${
                  st?.ready
                    ? "bg-green-950/50 text-green-300"
                    : st && st.score >= 50
                      ? "bg-amber-950/40 text-amber-200"
                      : "bg-panel-border/50 text-panel-muted"
                }`}
              >
                {d.id}
              </span>
            );
          })}
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {error && <Alert>{error}</Alert>}

      <Card className="border-panel-accent/40 bg-panel-accent/5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-lg font-medium text-white">Voortgang</p>
            <p className="mt-1 text-sm text-panel-muted">
              {data.readyCount} van 8 fasen ≥80% checks · totaal{" "}
              {data.overallPercent}%
            </p>
          </div>
          <Button variant="secondary" onClick={() => void load()} disabled={loading}>
            {loading ? "…" : "Ververs status"}
          </Button>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-panel-border">
          <div
            className="h-full bg-panel-accent transition-all"
            style={{ width: `${data.overallPercent}%` }}
          />
        </div>
      </Card>

      <div className="space-y-3">
        {data.definitions.map((phase) => {
          const st = statusByPhase.get(phase.id);
          const isOpen = open === phase.id;
          return (
            <Card key={phase.id} className="overflow-hidden">
              <button
                type="button"
                className="flex w-full items-start justify-between gap-4 p-4 text-left"
                onClick={() => setOpen(isOpen ? null : phase.id)}
              >
                <div className="flex gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-panel-border text-lg font-semibold text-white">
                    {phase.id}
                  </span>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-panel-muted">
                      {phase.subtitle}
                    </p>
                    <h2 className="text-lg font-medium text-white">{phase.title}</h2>
                    <p className="mt-1 text-sm text-panel-muted">{phase.summary}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p
                    className={`text-sm font-medium ${
                      st?.ready ? "text-green-400" : "text-amber-300"
                    }`}
                  >
                    {st?.score ?? 0}%
                  </p>
                  <p className="text-xs text-panel-muted">{isOpen ? "▲" : "▼"}</p>
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-panel-border px-4 pb-4 pt-2 space-y-4">
                  <ul className="grid gap-1 sm:grid-cols-2">
                    {phase.highlights.map((h) => (
                      <li key={h} className="text-sm text-panel-muted">
                        · {h}
                      </li>
                    ))}
                  </ul>

                  {st && st.checks.length > 0 && (
                    <dl className="space-y-2 text-sm">
                      {st.checks.map((c) => (
                        <div key={c.id} className="flex justify-between gap-4">
                          <dt className="text-panel-muted">{c.label}</dt>
                          <dd className={c.ok ? "text-green-400" : "text-amber-300"}>
                            {c.detail}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {phase.adminLinks.map((l) => (
                      <Link
                        key={l.href}
                        href={l.href}
                        className="rounded-md border border-panel-border px-3 py-1.5 text-sm text-white hover:bg-panel-border/30"
                      >
                        {l.label}
                      </Link>
                    ))}
                  </div>

                  {phase.domainLinks.length > 0 && (
                    <p className="text-xs text-panel-muted">
                      Per domein:{" "}
                      {phase.domainLinks.map((l) => l.label).join(" · ")} (kies domein in
                      Domains)
                    </p>
                  )}

                  <details className="text-sm">
                    <summary className="cursor-pointer text-panel-link">
                      Checklist &amp; CLI
                    </summary>
                    <ul className="mt-2 list-inside list-disc space-y-1 text-panel-muted">
                      {phase.checklist.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                    {phase.envKeys.length > 0 && (
                      <p className="mt-2 font-mono text-xs text-white">
                        {phase.envKeys.join(" · ")}
                      </p>
                    )}
                    <pre className="mt-2 overflow-x-auto rounded bg-black/40 p-3 text-xs text-panel-muted">
                      {phase.verifyCli.join("\n")}
                    </pre>
                    <a
                      href={`https://github.com/macdirtycow/qadbak/blob/main/${phase.docPath}`}
                      className="mt-2 inline-block text-panel-link hover:underline"
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {phase.docPath}
                    </a>
                  </details>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
