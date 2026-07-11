"use client";

import { Alert, Button, Card, Input, Label } from "@/components/ui";
import type { MailDomainSettings } from "@/lib/provisioner";
import type { MailDnsHints } from "@/lib/mail-dns-types";
import Link from "next/link";
import { useDomainNavReset } from "@/hooks/useDomainNavReset";
import { useState } from "react";
import { DomainPageHeader } from "./DomainPageHeader";

export function MailSettingsManager({
  domain,
  initialSettings,
  initialError,
}: {
  domain: string;
  initialSettings: MailDomainSettings;
  initialError: string;
}) {
  const enc = encodeURIComponent(domain);
  const [settings, setSettings] = useState(initialSettings);
  const [dns, setDns] = useState<MailDnsHints | null>(null);
  const [dnsError, setDnsError] = useState("");
  const [error, setError] = useState(initialError);
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useDomainNavReset(domain, () => {
    setSettings(initialSettings);
    setError(initialError);
    setSuccess("");
    setDns(null);
    setDnsError("");
    void fetch(`/api/domains/${encodeURIComponent(domain)}/mail-dns`)
      .then((r) => r.json())
      .then((data: { hints?: MailDnsHints; error?: string }) => {
        if (data.hints) setDns(data.hints);
        else if (data.error) setDnsError(data.error);
      })
      .catch(() => setDnsError("Could not load DNS hints."));
  });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/domains/${enc}/mail-settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed.");
      setSuccess("Mail settings saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  const mailHost = dns?.mailHost ?? "mail";

  return (
    <div className="space-y-6">
      <DomainPageHeader
        domain={domain}
        title="Mail settings"
        description="Catch-all, autoresponder, and how to connect your domain to mail"
      />
      {error && <Alert>{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <Card>
        <h2 className="text-lg font-medium text-white">Mail on this server</h2>
        <p className="mt-1 text-sm text-panel-muted">
          Use these DNS records at your provider (Cloudflare, etc.) when{" "}
          <strong className="text-white">this VPS</strong> handles mail for{" "}
          {domain}. MX and mail A must be <strong className="text-white">DNS only</strong>{" "}
          (not proxied through Cloudflare).
        </p>
        {dnsError && (
          <p className="mt-2 text-sm text-amber-300">{dnsError}</p>
        )}
        {dns?.records && dns.records.length > 0 ? (
          <ul className="mt-4 space-y-2 text-sm text-panel-muted">
            {dns.records.map((r) => (
              <li
                key={`${r.type}-${r.name}-${r.value}`}
                className="rounded-lg border border-panel-border bg-panel-bg/50 px-3 py-2"
              >
                <span className="font-medium text-white">{r.type}</span>{" "}
                <code className="text-white">{r.name}</code>
                {r.priority ? ` priority ${r.priority} ` : " "}
                → <code className="break-all text-white">{r.value}</code>
                {r.note ? (
                  <span className="mt-1 block text-xs">{r.note}</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-panel-muted">
            Loading DNS suggestions… or open{" "}
            <Link href={`/domains/${enc}/dns`} className="text-panel-link hover:underline">
              DNS
            </Link>{" "}
            to add records manually.
          </p>
        )}
        {dns?.ports && (
          <p className="mt-3 text-xs text-panel-muted">{dns.ports}</p>
        )}
        {dns?.onThisServer && (
          <p className="mt-3 text-sm text-panel-muted">
            <strong className="text-white">Clients & Qmail:</strong> IMAP{" "}
            <code className="text-white">{mailHost}</code> port 993, SMTP submission port
            587, same password as in{" "}
            <Link href={`/domains/${enc}/mail/accounts`} className="text-panel-link hover:underline">
              Mail → Accounts
            </Link>
            . {dns.onThisServer.note}
          </p>
        )}
      </Card>

      <Card>
        <h2 className="text-lg font-medium text-white">External mail provider</h2>
        <p className="mt-1 text-sm text-panel-muted">
          If mail is hosted at Google Workspace, Microsoft 365, Zoho, or another
          provider, configure DNS there — do <strong className="text-white">not</strong>{" "}
          point MX to this VPS. Your website can stay here; only mail DNS moves.
        </p>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-panel-muted">
          <li>Add {domain} in the provider&apos;s admin console and verify ownership (TXT).</li>
          <li>Copy the MX (and any CNAME) records the provider gives you.</li>
          <li>At Cloudflare or your DNS host: set those MX records; remove MX to this server.</li>
          <li>Wait for DNS propagation (up to 24–48h, often faster).</li>
        </ol>

        <div className="mt-6 space-y-6">
          {(dns?.externalProviders ?? []).map((provider) => (
            <div
              key={provider.id}
              className="rounded-lg border border-panel-border bg-panel-bg/40 p-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-medium text-white">{provider.name}</h3>
                {provider.setupUrl ? (
                  <a
                    href={provider.setupUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-panel-link hover:underline"
                  >
                    Open setup →
                  </a>
                ) : null}
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-panel-muted">
                {provider.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ul>
              {provider.mx.length > 0 && (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-xs text-panel-muted">
                    <thead>
                      <tr className="border-b border-panel-border text-panel-muted">
                        <th className="py-1 pr-3">Priority</th>
                        <th className="py-1">Mail server (MX target)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {provider.mx.map((mx, i) => (
                        <tr key={i} className="border-b border-panel-border/50">
                          <td className="py-1.5 pr-3 font-mono text-white">
                            {mx.priority}
                          </td>
                          <td className="py-1.5 font-mono text-white break-all">
                            {mx.host}
                            {mx.note ? (
                              <span className="mt-0.5 block font-sans text-panel-muted">
                                {mx.note}
                              </span>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-medium text-white">Catch-all & autoresponder</h2>
        <form onSubmit={save} className="mt-4 space-y-4">
          <div>
            <Label>Catch-all address</Label>
            <p className="mt-1 text-xs text-panel-muted">
              Mailbox that receives mail to unknown addresses, e.g.{" "}
              <code className="text-white">info</code>. Leave empty to disable.
              Only applies when mail is handled on this server.
            </p>
            <Input
              className="mt-1"
              placeholder="empty = off"
              value={settings.catchAll ?? ""}
              onChange={(e) =>
                setSettings({ ...settings, catchAll: e.target.value })
              }
            />
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.autoresponderEnabled ?? false}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  autoresponderEnabled: e.target.checked,
                })
              }
            />
            <span className="text-sm text-white">Autoresponder enabled</span>
          </label>
          <div>
            <Label>Autoresponder text</Label>
            <textarea
              className="mt-1 w-full rounded-lg border border-panel-border bg-panel-bg px-3 py-2 text-sm text-white"
              rows={4}
              value={settings.autoresponder ?? ""}
              onChange={(e) =>
                setSettings({ ...settings, autoresponder: e.target.value })
              }
            />
          </div>
          <Button type="submit" disabled={loading}>
            Save
          </Button>
        </form>
      </Card>
    </div>
  );
}
