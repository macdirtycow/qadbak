"use client";

import Link from "next/link";
import { Alert, Button, Card, Input, Label } from "@/components/ui";
import { useEffect, useState } from "react";
import { DomainPageHeader } from "./DomainPageHeader";

type ModsecEntry = {
  id?: string;
  msg?: string;
  uri?: string;
  severity?: string;
  preview?: string;
};

type MalwareConfig = {
  schedule?: string;
  enabled?: boolean;
  quarantine?: boolean;
  lastScanAt?: string | null;
  lastInfected?: number;
};

export function SecurityManager({
  domain,
  initialError,
  isAdmin,
}: {
  domain: string;
  initialError: string;
  isAdmin: boolean;
}) {
  const enc = encodeURIComponent(domain);
  const [spamEnabled, setSpamEnabled] = useState(false);
  const [dkimEnabled, setDkimEnabled] = useState(false);
  const [modsecurityEnabled, setModsecurityEnabled] = useState(false);
  const [crsInstalled, setCrsInstalled] = useState(false);
  const [fail2ban, setFail2ban] = useState("");
  const [scanResult, setScanResult] = useState("");
  const [modsecEntries, setModsecEntries] = useState<ModsecEntry[]>([]);
  const [modsecLogPath, setModsecLogPath] = useState("");
  const [logFilter, setLogFilter] = useState("");
  const [malwareCfg, setMalwareCfg] = useState<MalwareConfig>({
    schedule: "0 4 * * 0",
    enabled: false,
    quarantine: true,
  });
  const [malwareReports, setMalwareReports] = useState<string[]>([]);
  const [quarantined, setQuarantined] = useState<string[]>([]);
  const [error, setError] = useState(initialError);
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    const res = await fetch(`/api/domains/${enc}/security`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Load failed");
    setSpamEnabled(Boolean(data.mail?.spamEnabled));
    setDkimEnabled(Boolean(data.mail?.dkimEnabled));
    setModsecurityEnabled(Boolean(data.modsecurity?.enabled));
    setCrsInstalled(Boolean(data.modsecurity?.crsInstalled));
    if (data.fail2ban) setFail2ban(String(data.fail2ban).slice(0, 2000));
  }

  async function loadMalware() {
    const res = await fetch(`/api/domains/${enc}/security?malware=1`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Load failed");
    const m = data.malware ?? {};
    if (m.config) setMalwareCfg(m.config);
    setMalwareReports(m.reports ?? []);
    setQuarantined(m.quarantined ?? []);
  }

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Error"));
    if (isAdmin) {
      loadMalware().catch(() => {});
    }
  }, [enc, isAdmin]);

  async function saveMail() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/domains/${enc}/security`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spamEnabled, dkimEnabled }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Save failed");
      }
      setSuccess("Mail security saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function saveWaf() {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/domains/${enc}/security`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modsecurityEnabled }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Save failed");
      }
      setSuccess("ModSecurity WAF saved (nginx reloaded when possible).");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function loadModsecLogs() {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const q = new URLSearchParams({ modsecLogs: "1", lines: "150" });
      if (logFilter.trim()) q.set("grep", logFilter.trim());
      const res = await fetch(`/api/domains/${enc}/security?${q}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      const logs = data.modsecurityLogs ?? {};
      setModsecEntries(logs.entries ?? []);
      setModsecLogPath(logs.path ?? "");
      setCrsInstalled(Boolean(data.crs?.installed ?? logs.crsInstalled));
      if (logs.note && !(logs.entries?.length)) {
        setModsecEntries([{ preview: logs.note }]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function runMalwareScan() {
    if (!isAdmin) return;
    setLoading(true);
    setScanResult("");
    try {
      const res = await fetch(`/api/domains/${enc}/security`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "malware-scan" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Scan failed");
      setScanResult(data.summary ?? JSON.stringify(data));
      setSuccess(
        data.infected
          ? `Scan finished — ${data.infected} infected file(s).`
          : "ClamAV scan finished — no infections.",
      );
      await loadMalware();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function saveMalwareSchedule() {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/domains/${enc}/security`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "malware-schedule",
          schedule: malwareCfg.schedule,
          malwareEnabled: malwareCfg.enabled,
          quarantine: malwareCfg.quarantine,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Save failed");
      }
      setSuccess("Malware scan schedule saved.");
      await loadMalware();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <DomainPageHeader
        domain={domain}
        title="Security"
        description="Mail filtering, OWASP CRS WAF, scheduled ClamAV scans, and quarantine"
      />
      {error && <Alert>{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {isAdmin && (
        <Card className="border-panel-accent/30 bg-panel-accent/5">
          <h2 className="text-sm font-medium text-white">Privacy on this domain</h2>
          <p className="mt-2 text-sm text-panel-muted">
            WAF logs, malware scans, and mail filters run locally on your VPS — nothing is
            sent to Qadbak cloud. Review panel-wide data flows in{" "}
            <Link href="/admin/privacy" className="text-panel-link hover:underline">
              Privacy &amp; data
            </Link>{" "}
            or sign-in attempts in{" "}
            <Link href="/admin/audit" className="text-panel-link hover:underline">
              Activity log
            </Link>
            .
          </p>
        </Card>
      )}

      <Card className="space-y-4">
        <h2 className="text-lg font-medium text-white">Mail</h2>
        <label className="flex items-center justify-between gap-4">
          <span className="text-sm text-panel-muted">SpamAssassin</span>
          <input
            type="checkbox"
            checked={spamEnabled}
            onChange={(e) => setSpamEnabled(e.target.checked)}
          />
        </label>
        <label className="flex items-center justify-between gap-4">
          <span className="text-sm text-panel-muted">DKIM</span>
          <input
            type="checkbox"
            checked={dkimEnabled}
            onChange={(e) => setDkimEnabled(e.target.checked)}
          />
        </label>
        <Button disabled={loading} onClick={saveMail}>
          Save mail settings
        </Button>
      </Card>

      {isAdmin && (
        <>
          <Card className="space-y-4">
            <h2 className="text-lg font-medium text-white">Malware protection (ClamAV)</h2>
            <p className="text-sm text-panel-muted">
              Scheduled scans with optional quarantine to{" "}
              <code className="text-xs">~/.qadbak-quarantine</code> (Imunify-style workflow).
            </p>
            <label className="flex items-center justify-between gap-4">
              <span className="text-sm text-panel-muted">Enable scheduled scan</span>
              <input
                type="checkbox"
                checked={Boolean(malwareCfg.enabled)}
                onChange={(e) =>
                  setMalwareCfg((c) => ({ ...c, enabled: e.target.checked }))
                }
              />
            </label>
            <label className="flex items-center justify-between gap-4">
              <span className="text-sm text-panel-muted">Quarantine infected files</span>
              <input
                type="checkbox"
                checked={malwareCfg.quarantine !== false}
                onChange={(e) =>
                  setMalwareCfg((c) => ({ ...c, quarantine: e.target.checked }))
                }
              />
            </label>
            <div>
              <Label>Cron schedule</Label>
              <Input
                value={malwareCfg.schedule ?? ""}
                onChange={(e) =>
                  setMalwareCfg((c) => ({ ...c, schedule: e.target.value }))
                }
                placeholder="0 4 * * 0"
              />
            </div>
            {malwareCfg.lastScanAt && (
              <p className="text-xs text-panel-muted">
                Last scan: {malwareCfg.lastScanAt}
                {malwareCfg.lastInfected != null
                  ? ` — ${malwareCfg.lastInfected} infected`
                  : ""}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" disabled={loading} onClick={saveMalwareSchedule}>
                Save schedule
              </Button>
              <Button variant="secondary" disabled={loading} onClick={runMalwareScan}>
                Scan now
              </Button>
            </div>
            {scanResult && (
              <pre className="max-h-40 overflow-auto text-xs text-panel-muted whitespace-pre-wrap">
                {scanResult}
              </pre>
            )}
            {quarantined.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-white">Quarantined</h3>
                <ul className="text-xs text-panel-muted list-disc pl-4 max-h-32 overflow-auto">
                  {quarantined.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </div>
            )}
            {malwareReports.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-white">Recent reports</h3>
                <ul className="text-xs text-panel-muted list-disc pl-4">
                  {malwareReports.slice(0, 8).map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          <Card className="space-y-4">
            <h2 className="text-lg font-medium text-white">ModSecurity + OWASP CRS</h2>
            {!crsInstalled && (
              <Alert>
                CRS rule files not detected on host. Install libnginx-mod-security and
                modsecurity-crs for full protection.
              </Alert>
            )}
            <label className="flex items-center justify-between gap-4">
              <span className="text-sm text-panel-muted">WAF enabled (per domain)</span>
              <input
                type="checkbox"
                checked={modsecurityEnabled}
                onChange={(e) => setModsecurityEnabled(e.target.checked)}
              />
            </label>
            <Button variant="secondary" disabled={loading} onClick={saveWaf}>
              Save WAF
            </Button>
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-[12rem]">
                <Label>Log filter (optional)</Label>
                <Input
                  value={logFilter}
                  onChange={(e) => setLogFilter(e.target.value)}
                  placeholder={domain}
                />
              </div>
              <Button variant="ghost" disabled={loading} onClick={loadModsecLogs}>
                Load CRS audit log
              </Button>
            </div>
            {modsecLogPath && (
              <p className="text-xs text-panel-muted">Source: {modsecLogPath}</p>
            )}
            {modsecEntries.length > 0 && (
              <div className="overflow-auto max-h-64 border border-panel-border rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="text-panel-muted border-b border-panel-border">
                    <tr>
                      <th className="p-2">Rule</th>
                      <th className="p-2">Severity</th>
                      <th className="p-2">URI</th>
                      <th className="p-2">Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modsecEntries.map((e, i) => (
                      <tr key={i} className="border-t border-panel-border/50">
                        <td className="p-2 font-mono">{e.id ?? "—"}</td>
                        <td className="p-2">{e.severity ?? "—"}</td>
                        <td className="p-2 max-w-[8rem] truncate" title={e.uri}>
                          {e.uri ?? "—"}
                        </td>
                        <td className="p-2">{e.msg ?? e.preview?.slice(0, 120) ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {fail2ban && (
              <>
                <h3 className="text-sm font-medium text-white">Fail2ban (host)</h3>
                <pre className="max-h-24 overflow-auto text-xs text-panel-muted whitespace-pre-wrap">
                  {fail2ban}
                </pre>
              </>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
