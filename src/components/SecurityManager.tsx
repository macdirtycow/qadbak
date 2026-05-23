"use client";

import { Alert, Button, Card } from "@/components/ui";
import type { MailSecuritySettings } from "@/lib/provisioner";
import { useState } from "react";
import { DomainPageHeader } from "./DomainPageHeader";

export function SecurityManager({
  domain,
  initialSettings,
  initialError,
}: {
  domain: string;
  initialSettings: MailSecuritySettings;
  initialError: string;
}) {
  const enc = encodeURIComponent(domain);
  const [spamEnabled, setSpamEnabled] = useState(
    initialSettings.spamEnabled ?? false,
  );
  const [dkimEnabled, setDkimEnabled] = useState(
    initialSettings.dkimEnabled ?? false,
  );
  const [error, setError] = useState(initialError);
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/domains/${enc}/security`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spamEnabled, dkimEnabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed.");
      setSuccess("Settings saved on the server.");
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
        title="Spam & DKIM"
        description="Email security for this domain"
      />
      {error && <Alert>{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <Card className="space-y-6">
        <label className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium text-white">Spamfilter (SpamAssassin)</p>
            <p className="text-sm text-panel-muted">
              Scan incoming mail for spam
            </p>
          </div>
          <input
            type="checkbox"
            checked={spamEnabled}
            onChange={(e) => setSpamEnabled(e.target.checked)}
            className="h-5 w-5 rounded border-panel-border"
          />
        </label>
        <label className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium text-white">DKIM</p>
            <p className="text-sm text-panel-muted">
              Digital signature for outgoing mail
            </p>
          </div>
          <input
            type="checkbox"
            checked={dkimEnabled}
            onChange={(e) => setDkimEnabled(e.target.checked)}
            className="h-5 w-5 rounded border-panel-border"
          />
        </label>
        <Button onClick={save} disabled={loading}>
          {loading ? "Working…" : "Save"}
        </Button>
      </Card>

      <Alert variant="info">
        Spam uses SpamAssassin when installed; DKIM uses OpenDKIM keys under
        /etc/opendkim/keys/. Settings are stored per domain and applied by Qadbak
        native helpers.
      </Alert>
    </div>
  );
}
