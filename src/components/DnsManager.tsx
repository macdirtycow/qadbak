"use client";

import { Alert, Button, Card, ConfirmDialog, Input, Label } from "@/components/ui";
import type { DnsRecord } from "@/lib/virtualmin";
import { useEffect, useState } from "react";
import { DomainPageHeader } from "./DomainPageHeader";

export function DnsManager({
  domain,
  initialRecords,
  initialError,
}: {
  domain: string;
  initialRecords: DnsRecord[];
  initialError: string;
}) {
  const enc = encodeURIComponent(domain);
  const [records, setRecords] = useState(initialRecords);
  const [error, setError] = useState(initialError);
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("@");
  const [type, setType] = useState("A");
  const [value, setValue] = useState("");
  const [ttl, setTtl] = useState("3600");
  const [originIp, setOriginIp] = useState("");
  const [deleteRecord, setDeleteRecord] = useState<DnsRecord | null>(null);
  const [confirmTyped, setConfirmTyped] = useState("");

  async function refresh() {
    const res = await fetch(`/api/domains/${enc}/dns`);
    const data = await res.json();
    if (res.ok) setRecords(data.records ?? []);
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/domains/${enc}/website-health`);
        const data = await res.json();
        if (res.ok && data.originIp) setOriginIp(data.originIp);
      } catch {
        /* ignore */
      }
    })();
  }, [enc]);

  async function removeRecord() {
    if (!deleteRecord) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/domains/${enc}/dns`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(deleteRecord),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed.");
      setSuccess("DNS record removed.");
      setDeleteRecord(null);
      setConfirmTyped("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  async function addRecord(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/domains/${enc}/dns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, type, value, ttl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed.");
      setSuccess("DNS record added or updated.");
      setValue("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <DomainPageHeader
        domain={domain}
        title="DNS"
        description={`Records for ${domain}`}
      />
      {error && <Alert>{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      {originIp && (
        <Alert>
          <p className="font-medium text-white">Cloudflare (orange cloud)</p>
          <p className="mt-1 text-sm text-panel-muted">
            A record @ and www must point to origin{" "}
            <span className="font-mono text-white">{originIp}</span> — not only
            Cloudflare proxy IPs. Error 523 = server unreachable on ports 80/443.
            See{" "}
            <a
              href="https://github.com/macdirtycow/qadbak/blob/main/docs/CLOUDFLARE.md"
              className="text-panel-accent underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              CLOUDFLARE.md
            </a>
            .
          </p>
        </Alert>
      )}

      <Card className="overflow-hidden p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-panel-border bg-panel-bg/50 text-panel-muted">
            <tr>
              <th className="px-6 py-3">Name</th>
              <th className="px-6 py-3">Type</th>
              <th className="px-6 py-3">Value</th>
              <th className="px-6 py-3">TTL</th>
              <th className="px-6 py-3 w-24" />
            </tr>
          </thead>
          <tbody>
            {records.map((r, i) => (
              <tr key={`${r.name}-${r.type}-${i}`} className="border-b border-panel-border/50">
                <td className="px-6 py-4 text-white">{r.name}</td>
                <td className="px-6 py-4">{r.type}</td>
                <td className="px-6 py-4 text-panel-muted break-all">{r.value}</td>
                <td className="px-6 py-4 text-panel-muted">{r.ttl ?? "—"}</td>
                <td className="px-6 py-4">
                  <Button
                    variant="ghost"
                    disabled={loading}
                    onClick={() => setDeleteRecord(r)}
                  >
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {records.length === 0 && (
          <p className="px-6 py-8 text-center text-panel-muted">No records.</p>
        )}
      </Card>

      <ConfirmDialog
        open={deleteRecord !== null}
        title="Delete DNS record?"
        description={
          deleteRecord
            ? `${deleteRecord.name} ${deleteRecord.type} ${deleteRecord.value}`
            : ""
        }
        confirmLabel="Delete"
        confirmValue={deleteRecord?.name ?? ""}
        typedValue={confirmTyped}
        onTypedChange={setConfirmTyped}
        onConfirm={removeRecord}
        onCancel={() => {
          setDeleteRecord(null);
          setConfirmTyped("");
        }}
        loading={loading}
      />

      <Card>
        <h2 className="text-lg font-medium text-white">Add record</h2>
        <form onSubmit={addRecord} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="dns-name">Name</Label>
            <Input id="dns-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="dns-type">Type</Label>
            <select
              id="dns-type"
              className="w-full rounded-lg border border-panel-border bg-panel-bg px-3 py-2 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SRV"].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="dns-value">Value</Label>
            <Input id="dns-value" value={value} onChange={(e) => setValue(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="dns-ttl">TTL</Label>
            <Input id="dns-ttl" value={ttl} onChange={(e) => setTtl(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={loading}>{loading ? "Working…" : "Add"}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
