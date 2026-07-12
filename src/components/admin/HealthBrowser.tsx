"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  HealthFinding,
  HealthReport,
  HealthSeverity,
} from "@/lib/health";
import { Alert, Badge, Button, Card } from "@/components/ui";

interface ApiResponse {
  report: HealthReport;
  error?: string;
}

const SEVERITY_LABEL: Record<HealthSeverity, string> = {
  critical: "Critical",
  warning: "Needs attention",
  info: "Heads-up",
};

const SEVERITY_TONE: Record<HealthSeverity, "danger" | "warning" | "default"> = {
  critical: "danger",
  warning: "warning",
  info: "default",
};

export function HealthBrowser() {
  const [report, setReport] = useState<HealthReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRunAt, setLastRunAt] = useState<number | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/health", { cache: "no-store" });
      const data = (await res.json()) as ApiResponse;
      if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`);
      setReport(data.report);
      setLastRunAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    run();
  }, [run]);

  const grouped = useMemo(() => {
    if (!report) return { critical: [], warning: [], info: [] };
    const out: Record<HealthSeverity, HealthFinding[]> = {
      critical: [],
      warning: [],
      info: [],
    };
    for (const f of report.findings) out[f.severity].push(f);
    return out;
  }, [report]);

  const failedChecks = report?.checks.filter((c) => !c.ok) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={run} disabled={loading}>
          {loading ? "Running checks…" : "Run health scan now"}
        </Button>
        {report ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-panel-muted">
            <Badge tone={grouped.critical.length > 0 ? "danger" : "default"}>
              {grouped.critical.length} critical
            </Badge>
            <Badge tone={grouped.warning.length > 0 ? "warning" : "default"}>
              {grouped.warning.length} warning
            </Badge>
            <Badge tone="default">{grouped.info.length} info</Badge>
            <span>·</span>
            <span>scan took {report.totalMs} ms</span>
            <span>·</span>
            <span>last refresh {lastRunAt ? relativeTime(lastRunAt) : " - "}</span>
          </div>
        ) : null}
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}

      {failedChecks.length > 0 ? (
        <Alert variant="error">
          <p className="font-medium text-white">
            {failedChecks.length} check{failedChecks.length === 1 ? "" : "s"} failed to run.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {failedChecks.map((c) => (
              <li key={c.checkId}>
                <strong>{c.checkId}</strong>: {c.error ?? "unknown error"}
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}

      {report && report.findings.length === 0 && failedChecks.length === 0 ? (
        <Card className="border-emerald-800/60 bg-emerald-950/30">
          <p className="text-sm text-emerald-200">
            <strong className="text-white">All clear.</strong> No critical
            disk, memory, SSL or service issues right now.{" "}
            <span className="text-emerald-300/70">
              ({report.checks.length} checks ran in {report.totalMs} ms)
            </span>
          </p>
        </Card>
      ) : null}

      {(Object.keys(grouped) as HealthSeverity[]).map((sev) => {
        const list = grouped[sev];
        if (list.length === 0) return null;
        return (
          <section key={sev} className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-panel-muted">
              {SEVERITY_LABEL[sev]} · {list.length}
            </h2>
            <div className="space-y-3">
              {list.map((f) => (
                <FindingCard key={f.id} finding={f} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function FindingCard({ finding }: { finding: HealthFinding }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    if (!finding.suggestedCommand) return;
    navigator.clipboard.writeText(finding.suggestedCommand).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <Card
      className={
        finding.severity === "critical"
          ? "border-red-900/60"
          : finding.severity === "warning"
            ? "border-amber-900/60"
            : ""
      }
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-white">{finding.title}</h3>
        <Badge tone={SEVERITY_TONE[finding.severity]}>
          {SEVERITY_LABEL[finding.severity]}
        </Badge>
      </div>
      <p className="mt-2 text-sm text-panel-muted">{finding.explanation}</p>

      {finding.suggestion ? (
        <p className="mt-3 text-sm text-panel-muted">
          <strong className="text-white">Fix · </strong>
          {finding.suggestion}
        </p>
      ) : null}

      {finding.suggestedCommand ? (
        <div className="mt-3 flex items-center gap-2">
          <pre className="flex-1 overflow-x-auto rounded bg-black/40 p-2 text-xs text-emerald-200">
            <span className="text-panel-muted">$ </span>
            {finding.suggestedCommand}
          </pre>
          <Button variant="secondary" onClick={copy}>
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      ) : null}

      {finding.evidence ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-panel-muted hover:text-white">
            Evidence
          </summary>
          <pre className="mt-2 overflow-x-auto rounded bg-black/40 p-2 text-xs text-slate-300">
            {finding.evidence}
          </pre>
        </details>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-x-3 text-[10px] uppercase tracking-wide text-panel-muted">
        <span>id: {finding.id}</span>
        <span>category: {finding.category}</span>
      </div>
    </Card>
  );
}

function relativeTime(ms: number): string {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return `${h}h ago`;
}
