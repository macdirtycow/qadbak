"use client";

import { Alert, Button, Card, Input, Label } from "@/components/ui";
import { useEffect, useState } from "react";

type Provider = {
  id: string;
  label: string;
  type: string;
  bucket: string;
  prefix: string;
  endpoint: string;
};

export function AdminCloudCredentials() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [id, setId] = useState("default");
  const [label, setLabel] = useState("Default S3");
  const [type, setType] = useState("s3");
  const [accessKey, setAccessKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [bucket, setBucket] = useState("");
  const [prefix, setPrefix] = useState("qadbak-backups");
  const [endpoint, setEndpoint] = useState("");

  async function load() {
    const res = await fetch("/api/admin/cloud-credentials");
    const data = await res.json();
    if (res.ok) setProviders(data.providers ?? []);
  }

  useEffect(() => {
    load().catch(() => {});
  }, []);

  async function save() {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/cloud-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          label,
          type,
          accessKey,
          secretKey,
          bucket,
          prefix,
          endpoint,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setSuccess("Credentials stored (encrypted).");
      setAccessKey("");
      setSecretKey("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="space-y-4">
      <h2 className="text-lg font-medium text-white">Offsite backup credentials</h2>
      <p className="text-sm text-panel-muted">
        Stored encrypted in data/cloud-credentials.json. Enable per-domain offsite under Backups.
      </p>
      {error && <Alert>{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}
      {providers.length > 0 && (
        <ul className="text-sm text-panel-muted">
          {providers.map((p) => (
            <li key={p.id}>
              {p.label} ({p.type}) → s3://{p.bucket}/{p.prefix}
              {p.endpoint ? ` via ${p.endpoint}` : ""}
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="cc-id">Provider ID</Label>
          <Input id="cc-id" value={id} onChange={(e) => setId(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="cc-label">Label</Label>
          <Input id="cc-label" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="cc-bucket">Bucket</Label>
          <Input id="cc-bucket" value={bucket} onChange={(e) => setBucket(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="cc-prefix">Prefix</Label>
          <Input id="cc-prefix" value={prefix} onChange={(e) => setPrefix(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="cc-endpoint">S3 endpoint (B2/GCS compat)</Label>
          <Input
            id="cc-endpoint"
            placeholder="https://s3.eu-central-003.backblazeb2.com"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="cc-ak">Access key</Label>
          <Input id="cc-ak" value={accessKey} onChange={(e) => setAccessKey(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="cc-sk">Secret key</Label>
          <Input
            id="cc-sk"
            type="password"
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value)}
          />
        </div>
      </div>
      <Button disabled={loading} onClick={() => save()}>
        {loading ? "Saving…" : "Save credentials"}
      </Button>
    </Card>
  );
}
