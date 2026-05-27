"use client";

import { Alert, Button, Card } from "@/components/ui";
import { useCallback, useEffect, useState } from "react";

type Probe = {
  ok: boolean;
  status?: number;
  error?: string;
  servingPanelLanding?: boolean;
  cloudflare523?: boolean;
  cloudflare502?: boolean;
  servingApacheDefault?: boolean;
  inferredFromPublic?: boolean;
};

type Health = {
  domain: string;
  originIp: string;
  repairAvailable?: boolean;
  validation: { valid: boolean; messages: string[] };
  localProbe: Probe;
  publicProbe: Probe;
  cloudflare: {
    issues: string[];
    dnsChecklist: string[];
  };
};

export function WebsiteHealthCard({
  domain,
  isAdmin,
}: {
  domain: string;
  isAdmin: boolean;
}) {
  const enc = encodeURIComponent(domain);
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [repairing, setRepairing] = useState(false);
  const [stackChecking, setStackChecking] = useState(false);
  const [stackLog, setStackLog] = useState("");
  const [error, setError] = useState("");
  const [repairLog, setRepairLog] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/domains/${enc}/website-health`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load status.");
      setHealth(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }, [enc]);

  useEffect(() => {
    load();
  }, [load]);

  async function validateStack() {
    setStackChecking(true);
    setError("");
    setStackLog("");
    try {
      const res = await fetch(`/api/domains/${enc}/stack`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Stack validate failed.");
      if (data.available === false) {
        setStackLog(data.error ?? "Stack helper not configured.");
        return;
      }
      const lines = (data.checks ?? []).map(
        (c: { label: string; ok: boolean; detail: string }) =>
          `${c.ok ? "OK" : "FAIL"} ${c.label}: ${c.detail}`,
      );
      setStackLog(lines.join("\n") || (data.ok ? "All stack checks passed." : "Issues found."));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setStackChecking(false);
    }
  }

  async function repair() {
    setRepairing(true);
    setError("");
    setRepairLog("");
    try {
      const res = await fetch(`/api/domains/${enc}/repair-website`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Repair failed.");
      setRepairLog(data.output ?? "Done.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setRepairing(false);
    }
  }

  const panelHijack =
    health?.localProbe.servingPanelLanding || health?.publicProbe.servingPanelLanding;
  const apacheDefault =
    health?.publicProbe.servingApacheDefault && !health?.publicProbe.ok;
  const localApacheNote =
    health?.publicProbe.ok && health?.localProbe.servingApacheDefault;
  const cf523 =
    health?.publicProbe.cloudflare523 && !health?.publicProbe.ok;
  const cf502 =
    health?.publicProbe.cloudflare502 && !health?.publicProbe.ok;
  const siteOk = health?.publicProbe.ok === true;
  const repairOk = health?.repairAvailable !== false;

  const subtitle = panelHijack
    ? "This domain shows the Qadbak landing page instead of your site in public_html."
    : apacheDefault
      ? "Visitors still see the Ubuntu/Apache default page — use Repair on server."
      : localApacheNote
        ? "Your site is live on the internet; local routing can be aligned with Repair (optional)."
      : cf502
      ? "Cloudflare error 502 — origin answers badly (nginx→Apache or HTTPS without cert)."
      : cf523
      ? "Cloudflare error 523 — the proxy cannot reach your origin on ports 80/443."
      : siteOk
        ? "Website is live — public_html is served for this domain."
        : "Checks public URL, origin routing, and Cloudflare DNS.";

  return (
    <Card
      className={
        panelHijack
          ? "border-rose-500/40"
          : siteOk
            ? "border-emerald-500/30"
            : cf523
              ? "border-amber-500/40"
              : "border-amber-500/40"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-white">Website status</h2>
          <p className="mt-1 text-sm text-panel-muted">{subtitle}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" disabled={loading} onClick={load}>
            Refresh
          </Button>
          {isAdmin && (
            <Button
              variant="ghost"
              disabled={stackChecking}
              onClick={validateStack}
            >
              {stackChecking ? "Checking…" : "Stack validate"}
            </Button>
          )}
          {isAdmin && repairOk && (
            <Button variant="secondary" disabled={repairing} onClick={repair}>
              {repairing ? "Repairing…" : "Repair on server"}
            </Button>
          )}
        </div>
      </div>

      {loading && (
        <p className="mt-4 text-sm text-panel-muted">Checking website…</p>
      )}
      {error && (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      )}
      {stackLog && (
        <pre className="mt-4 max-h-32 overflow-auto rounded-lg bg-panel-bg p-3 text-xs text-panel-muted">
          {stackLog}
        </pre>
      )}
      {repairLog && (
        <pre className="mt-4 max-h-40 overflow-auto rounded-lg bg-panel-bg p-3 text-xs text-panel-muted">
          {repairLog}
        </pre>
      )}

      {health && !repairOk && !loading && (
        <div className="mt-4">
          <Alert>
            Repair sudo is not configured yet. On the server (as root):{" "}
            <code className="text-white">
              cd /opt/qadbak && git pull && sudo bash scripts/configure-domain-repair-sudo.sh
            </code>
          </Alert>
        </div>
      )}

      {health && !loading && (
        <div className="mt-4 space-y-4 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-panel-muted">On this VPS (Host header)</p>
              <p
                className={
                  panelHijack && health.localProbe.servingPanelLanding
                    ? "text-rose-300"
                    : health.localProbe.ok
                      ? "text-emerald-400"
                      : "text-amber-300"
                }
              >
                {health.localProbe.servingPanelLanding
                  ? "Qadbak landing — not public_html"
                  : health.localProbe.inferredFromPublic
                    ? `OK via internet — HTTP ${health.publicProbe.status ?? ""}`
                  : health.localProbe.servingApacheDefault && !health.publicProbe.ok
                    ? "Apache fallback (not public_html)"
                    : health.localProbe.servingApacheDefault && health.publicProbe.ok
                      ? `OK via internet — local HTTP ${health.localProbe.status ?? ""}`
                      : health.localProbe.ok
                    ? `OK — HTTP ${health.localProbe.status ?? ""}`
                    : health.localProbe.error ?? "No response"}
              </p>
            </div>
            <div>
              <p className="text-panel-muted">Public (https://{domain})</p>
              <p
                className={
                  health.publicProbe.cloudflare523
                    ? "text-amber-300"
                    : health.publicProbe.servingPanelLanding
                      ? "text-rose-300"
                      : health.publicProbe.ok
                        ? "text-emerald-400"
                        : "text-amber-300"
                }
              >
                {health.publicProbe.servingApacheDefault
                  ? "Ubuntu/Apache default page — not your site"
                  : health.publicProbe.cloudflare502
                  ? `Cloudflare 502 — HTTP ${health.publicProbe.status ?? ""}`
                  : health.publicProbe.cloudflare523
                  ? `Cloudflare 523 — HTTP ${health.publicProbe.status ?? ""}`
                  : health.publicProbe.servingPanelLanding
                    ? "Qadbak landing — not your site"
                    : health.publicProbe.ok
                      ? `OK — HTTP ${health.publicProbe.status ?? ""}`
                      : health.publicProbe.error ?? "Not reachable"}
              </p>
            </div>
          </div>

          <div>
            <p className="text-panel-muted">Origin IP (Cloudflare A record)</p>
            <p className="font-mono text-white">
              {health.originIp || "Set QADBAK_ORIGIN_IP in server .env.local"}
            </p>
          </div>

          {!health.validation.valid && health.validation.messages.length > 0 && (
            <Alert>
              <ul className="list-inside list-disc">
                {health.validation.messages.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </Alert>
          )}

          {health.cloudflare.issues.length > 0 && (
            <Alert variant={siteOk ? "info" : undefined}>
              <p className="font-medium text-white">Diagnosis</p>
              <ul className="mt-2 list-inside list-disc text-panel-muted">
                {health.cloudflare.issues.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </Alert>
          )}

          <div>
            <p className="font-medium text-white">Cloudflare checklist</p>
            <ul className="mt-2 list-inside list-disc text-panel-muted">
              {health.cloudflare.dnsChecklist.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Card>
  );
}
