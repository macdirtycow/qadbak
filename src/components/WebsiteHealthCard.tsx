"use client";

import { Alert, Button, Card } from "@/components/ui";
import { useCallback, useEffect, useState } from "react";

type Health = {
  domain: string;
  originIp: string;
  repairAvailable?: boolean;
  validation: { valid: boolean; messages: string[] };
  localProbe: { ok: boolean; status?: number; error?: string };
  cloudflare: {
    error523LikelyCauses: string[];
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

  const localOk = health?.localProbe.ok;
  const repairOk = health?.repairAvailable !== false;
  const showCloudflareHelp = health && (localOk || !localOk);

  return (
    <Card className={localOk ? "border-emerald-500/30" : "border-amber-500/40"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-white">Website & Cloudflare</h2>
          <p className="mt-1 text-sm text-panel-muted">
            Error 523 = Cloudflare cannot reach your server. Check origin IP and ports 80/443.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" disabled={loading} onClick={load}>
            Refresh
          </Button>
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
      {repairLog && (
        <pre className="mt-4 max-h-40 overflow-auto rounded-lg bg-panel-bg p-3 text-xs text-panel-muted">
          {repairLog}
        </pre>
      )}

      {health && !repairOk && !loading && (
        <div className="mt-4">
          <Alert>
            Repair-knop niet beschikbaar voor de qadbak-gebruiker. Op de server:{" "}
            <code className="text-white">
              sudo bash /opt/qadbak/scripts/configure-domain-repair-sudo.sh
            </code>{" "}
            daarna <code className="text-white">pm2 restart qadbak</code>.
          </Alert>
        </div>
      )}

      {health && !loading && (
        <div className="mt-4 space-y-4 text-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-panel-muted">Local web server (this VPS)</p>
              <p className={localOk ? "text-emerald-400" : "text-amber-300"}>
                {localOk
                  ? `OK — HTTP ${health.localProbe.status ?? ""}`
                  : `Not reachable — ${health.localProbe.error ?? "no response"}`}
              </p>
            </div>
            <div>
              <p className="text-panel-muted">Origin IP (for Cloudflare A record)</p>
              <p className="font-mono text-white">
                {health.originIp || "Set QADBAK_ORIGIN_IP in server .env.local"}
              </p>
            </div>
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

          {showCloudflareHelp && health.cloudflare.error523LikelyCauses.length > 0 && (
            <Alert variant={localOk ? "info" : undefined}>
              <p className="font-medium text-white">
                {localOk
                  ? "Server OK — Cloudflare 523 is a DNS/firewall issue"
                  : "Likely cause of Cloudflare 523"}
              </p>
              <ul className="mt-2 list-inside list-disc text-panel-muted">
                {health.cloudflare.error523LikelyCauses.map((c, i) => (
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
