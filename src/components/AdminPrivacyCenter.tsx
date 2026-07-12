"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Button, Card } from "@/components/ui";
import type { PrivacyReport } from "@/lib/privacy-report";

function formatBytes(n: number | null): string {
  if (n == null) return " - ";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export function AdminPrivacyCenter({
  initialReport,
  initialError,
}: {
  initialReport: PrivacyReport | null;
  initialError?: string;
}) {
  const [report, setReport] = useState(initialReport);
  const [error, setError] = useState(initialError ?? "");
  const [loading, setLoading] = useState(!initialReport);
  const [security, setSecurity] = useState<{
    firewall: { ruleCount: number; preview: string };
    fail2ban: { jailCount: number; jails: string[]; preview: string };
  } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/privacy");
      const data = (await res.json()) as PrivacyReport & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not load privacy report.");
      setReport(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialReport) void refresh();
  }, [initialReport, refresh]);

  useEffect(() => {
    fetch("/api/admin/security-snapshot")
      .then((r) => r.json())
      .then((d) => {
        if (d.firewall) setSecurity(d);
      })
      .catch(() => {});
  }, []);

  if (loading && !report) {
    return <p className="text-panel-muted">Loading privacy report…</p>;
  }

  if (!report) {
    return error ? <Alert>{error}</Alert> : null;
  }

  return (
    <div className="space-y-6">
      {error && <Alert>{error}</Alert>}

      <Card className="border-panel-accent/40 bg-panel-accent/5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-panel-accent">
              Privacy posture
            </p>
            <p className="mt-2 text-lg text-white">{report.summary}</p>
            <p className="mt-2 text-sm text-panel-muted">
              Generated {new Date(report.generatedAt).toLocaleString()} · Mode:{" "}
              <span className="text-white">{report.posture}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void refresh()} disabled={loading}>
              {loading ? "Refreshing…" : "Refresh"}
            </Button>
            <a
              href="/api/admin/privacy?export=audit"
              className="inline-flex items-center rounded-md border border-panel-border px-4 py-2 text-sm text-white hover:bg-panel-border/30"
            >
              Export audit log (tail)
            </a>
            <button
              type="button"
              className="inline-flex items-center rounded-md border border-panel-border px-4 py-2 text-sm text-white hover:bg-panel-border/30"
              onClick={async () => {
                setLoading(true);
                setError("");
                try {
                  const res = await fetch("/api/admin/privacy", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "rotate-audit" }),
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error ?? "Trim failed");
                  if (data.report) setReport(data.report);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Error");
                } finally {
                  setLoading(false);
                }
              }}
            >
              Trim audit log
            </button>
            <button
              type="button"
              className="inline-flex items-center rounded-md border border-panel-border px-4 py-2 text-sm text-white hover:bg-panel-border/30"
              onClick={() => {
                const blob = new Blob([JSON.stringify(report, null, 2)], {
                  type: "application/json",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `qadbak-privacy-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Download report (JSON)
            </button>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-medium text-white">Stays on your VPS</h2>
          <p className="mt-1 text-sm text-panel-muted">
            Qadbak does not upload customer sites, mail, or databases to our cloud.
          </p>
          <ul className="mt-4 list-inside list-disc space-y-2 text-sm text-panel-muted">
            {report.staysOnVps.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="text-lg font-medium text-white">Local storage</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-panel-muted">Audit log</dt>
              <dd className="text-right text-white">
                {report.storage.auditLogPath} ({formatBytes(report.storage.auditLogBytes)})
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-panel-muted">Panel users</dt>
              <dd className="text-white">{report.storage.usersPath}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-panel-muted">License cache</dt>
              <dd className="text-white">{report.storage.licensePath}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-panel-muted">API keys</dt>
            <dd className="text-white">{report.storage.apiKeysCount}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-panel-muted">2FA enabled (panel users)</dt>
            <dd className="text-white">
              {report.hardening.totpUsers}{" "}
              <Link href="/admin/totp" className="text-panel-link hover:underline">
                Manage
              </Link>
            </dd>
          </div>
          <div className="flex justify-between gap-4 sm:col-span-2">
            <dt className="text-panel-muted">Audit retention</dt>
            <dd className="text-right text-white">
              max {report.auditRetention.maxLines.toLocaleString()} lines
              {report.auditRetention.retentionDays > 0
                ? ` · ${report.auditRetention.retentionDays} days`
                : ""}
            </dd>
          </div>
            <div className="flex justify-between gap-4">
              <dt className="text-panel-muted">Offsite backup creds</dt>
              <dd className="text-white">
                {report.storage.cloudCredentialsConfigured ? "Configured" : "None"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-panel-muted">Alert webhooks</dt>
              <dd className="text-white">
                {report.storage.alertRulesConfigured ? "Configured" : "None"}
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      <Card>
        <h2 className="text-lg font-medium text-white">Outbound connections</h2>
        <p className="mt-1 text-sm text-panel-muted">
          Only these channels can leave your server. Optional rows are off until you configure them.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-panel-border text-panel-muted">
                <th className="py-2 pr-4">Channel</th>
                <th className="py-2 pr-4">Destination</th>
                <th className="py-2 pr-4">When</th>
                <th className="py-2">Data</th>
              </tr>
            </thead>
            <tbody>
              {report.outbound.map((row) => (
                <tr key={row.id} className="border-b border-panel-border/60">
                  <td className="py-3 pr-4 align-top">
                    <span className="font-medium text-white">{row.name}</span>
                    {row.optional && (
                      <span className="ml-2 text-xs text-panel-muted">(optional)</span>
                    )}
                    <p className="mt-1 text-xs text-panel-muted">
                      {row.enabled ? "Active" : "Inactive"}
                    </p>
                  </td>
                  <td className="py-3 pr-4 align-top text-panel-muted">{row.destination}</td>
                  <td className="py-3 pr-4 align-top text-panel-muted">{row.when}</td>
                  <td className="py-3 align-top text-panel-muted">
                    <ul className="list-inside list-disc">
                      {row.dataSent.map((d) => (
                        <li key={d}>{d}</li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-medium text-white">Premium license transparency</h2>
        <p className="mt-1 text-sm text-panel-muted">
          Status: <span className="text-white">{report.license.status}</span> · Last heartbeat:{" "}
          <span className="text-white">{report.license.lastHeartbeatAt ?? " - "}</span>
        </p>
        <p className="mt-3 text-sm text-panel-muted">
          Manage activations and heartbeat in{" "}
          <Link href="/admin/license" className="text-panel-link hover:underline">
            License
          </Link>
          . Public policy:{" "}
          <a
            href="https://qadbak.com/privacy"
            className="text-panel-link hover:underline"
            rel="noopener"
          >
            qadbak.com/privacy
          </a>
          .
        </p>
      </Card>

      <Card>
        <h2 className="text-lg font-medium text-white">Built-in protections</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-panel-muted">Failed logins (24h)</dt>
            <dd className="text-white">
              {report.hardening.failedLogins24h}
              {" · "}
              <Link href="/admin/audit?action=login-failed" className="text-panel-link hover:underline">
                Review
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-panel-muted">Login rate limit</dt>
            <dd className="text-white">
              {report.hardening.loginRateLimit ? "On" : "Off"}
            </dd>
          </div>
          <div>
            <dt className="text-panel-muted">API keys with IP allowlist</dt>
            <dd className="text-white">
              {report.hardening.apiKeysWithIpAllowlist} / {report.storage.apiKeysCount}
            </dd>
          </div>
          <div>
            <dt className="text-panel-muted">Terminal WebSocket bind</dt>
            <dd className="text-white">
              {report.hardening.terminalWsLocalOnly
                ? "127.0.0.1 (not exposed)"
                : "Custom host - review exposure"}
            </dd>
          </div>
          <div>
            <dt className="text-panel-muted">Session cookies</dt>
            <dd className="text-white">{report.session.cookieSecure}</dd>
          </div>
        </dl>
      </Card>

      <Card>
        <h2 className="text-lg font-medium text-white">Hardening &amp; features</h2>
        <p className="mt-1 text-sm text-panel-muted">
          Tools that improve privacy and security without sending customer data away.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/admin/firewall" className="rounded-md border border-panel-border px-3 py-1.5 text-sm text-white hover:bg-panel-border/30">
            Firewall
          </Link>
          <Link href="/admin/journal" className="rounded-md border border-panel-border px-3 py-1.5 text-sm text-white hover:bg-panel-border/30">
            Action journal
          </Link>
          <Link href="/admin/audit" className="rounded-md border border-panel-border px-3 py-1.5 text-sm text-white hover:bg-panel-border/30">
            Activity log
          </Link>
          <Link href="/admin/api-keys" className="rounded-md border border-panel-border px-3 py-1.5 text-sm text-white hover:bg-panel-border/30">
            API keys (scopes)
          </Link>
          <Link href="/admin/health" className="rounded-md border border-panel-border px-3 py-1.5 text-sm text-white hover:bg-panel-border/30">
            Health checks
          </Link>
          <Link href="/admin/status" className="rounded-md border border-panel-border px-3 py-1.5 text-sm text-white hover:bg-panel-border/30">
            Metrics &amp; alerts
          </Link>
          <Link href="/domains" className="rounded-md border border-panel-border px-3 py-1.5 text-sm text-white hover:bg-panel-border/30">
            Domain security (WAF)
          </Link>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-medium text-white">Recommendations</h2>
        <ul className="mt-4 list-inside list-disc space-y-2 text-sm text-panel-muted">
          {report.recommendations.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="text-lg font-medium text-white">Relevant .env.local keys</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-panel-border text-panel-muted">
                <th className="py-2 pr-4">Key</th>
                <th className="py-2 pr-4">Value</th>
                <th className="py-2">Note</th>
              </tr>
            </thead>
            <tbody>
              {report.envHints.map((row) => (
                <tr key={row.key} className="border-b border-panel-border/60">
                  <td className="py-2 pr-4 font-mono text-xs text-white">{row.key}</td>
                  <td className="py-2 pr-4 text-panel-muted">{row.value}</td>
                  <td className="py-2 text-panel-muted">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
