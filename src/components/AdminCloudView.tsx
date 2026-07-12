"use client";

import { Alert, Button, Card, Input, Label } from "@/components/ui";
import type { S3Bucket, S3File } from "@/lib/provisioner";
import { useState } from "react";

export function AdminCloudView({ initialError }: { initialError: string }) {
  const [accessKey, setAccessKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [buckets, setBuckets] = useState<S3Bucket[]>([]);
  const [selectedBucket, setSelectedBucket] = useState("");
  const [files, setFiles] = useState<S3File[]>([]);
  const [uploadKey, setUploadKey] = useState("");
  const [uploadSource, setUploadSource] = useState("");
  const [error, setError] = useState(initialError);
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function apiCall(body: Record<string, string>) {
    const res = await fetch("/api/admin/cloud", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Request failed.");
    return data;
  }

  async function loadBuckets() {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const data = await apiCall({
        action: "buckets",
        accessKey,
        secretKey,
      });
      setBuckets(data.buckets ?? []);
      setFiles([]);
      setSelectedBucket("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  async function loadFiles(bucket: string) {
    setLoading(true);
    setError("");
    try {
      const data = await apiCall({
        action: "files",
        accessKey,
        secretKey,
        bucket,
      });
      setSelectedBucket(bucket);
      setFiles(data.files ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  async function upload() {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await apiCall({
        action: "upload",
        accessKey,
        secretKey,
        bucket: selectedBucket,
        key: uploadKey,
        source: uploadSource,
      });
      setSuccess("Upload started.");
      if (selectedBucket) await loadFiles(selectedBucket);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && <Alert>{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <Card>
        <h2 className="text-lg font-medium text-white">S3 credentials</h2>
        <p className="mt-1 text-sm text-panel-muted">
          Keys are not stored; only used for this request.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="s3-access">Access key</Label>
            <Input
              id="s3-access"
              className="mt-1"
              value={accessKey}
              onChange={(e) => setAccessKey(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div>
            <Label htmlFor="s3-secret">Secret key</Label>
            <Input
              id="s3-secret"
              type="password"
              className="mt-1"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>
        <Button className="mt-4" onClick={loadBuckets} disabled={loading}>
          Load buckets
        </Button>
      </Card>

      {buckets.length > 0 && (
        <Card className="overflow-hidden p-0">
          <h2 className="px-6 pt-6 text-lg font-medium text-white">Buckets</h2>
          <ul className="mt-4 divide-y divide-panel-border">
            {buckets.map((b) => (
              <li key={b.name} className="flex items-center justify-between px-6 py-3">
                <span className="text-white">
                  {b.name}
                  {b.region && (
                    <span className="ml-2 text-sm text-panel-muted">{b.region}</span>
                  )}
                </span>
                <Button
                  variant="secondary"
                  disabled={loading}
                  onClick={() => loadFiles(b.name)}
                >
                  Files
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {selectedBucket && (
        <Card className="overflow-hidden p-0">
          <h2 className="px-6 pt-6 text-lg font-medium text-white">
            Files in {selectedBucket}
          </h2>
          <table className="mt-4 w-full text-left text-sm">
            <thead className="border-t border-panel-border text-panel-muted">
              <tr>
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Size</th>
                <th className="px-6 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.name} className="border-t border-panel-border/50">
                  <td className="px-6 py-3 text-white">{f.name}</td>
                  <td className="px-6 py-3">{f.size ?? " - "}</td>
                  <td className="px-6 py-3">{f.modified ?? " - "}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {files.length === 0 && (
            <p className="px-6 py-8 text-center text-panel-muted">No files.</p>
          )}
        </Card>
      )}

      {selectedBucket && (
        <Card>
          <h2 className="text-lg font-medium text-white">Upload to bucket</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <Input
              placeholder="file name in bucket"
              value={uploadKey}
              onChange={(e) => setUploadKey(e.target.value)}
            />
            <Input
              placeholder="local path (optional)"
              value={uploadSource}
              onChange={(e) => setUploadSource(e.target.value)}
            />
            <Button onClick={upload} disabled={loading || !uploadKey.trim()}>
              Upload
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
