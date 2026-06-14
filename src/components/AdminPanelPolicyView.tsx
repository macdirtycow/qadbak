"use client";

import { Alert, Button, Card } from "@/components/ui";
import { useCallback, useEffect, useState } from "react";

export function AdminPanelPolicyView() {
  const [requireClientTotp, setRequireClientTotp] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/panel-policy");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load policy.");
      setRequireClientTotp(
        Boolean(data.requireClientTotp ?? data.policy?.requireClientTotp),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/panel-policy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requireClientTotp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save policy.");
      setSuccess("Panel policy saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="font-medium text-white">Client login policy</h2>
        <p className="mt-1 text-sm text-panel-muted">
          Require two-factor authentication for all client accounts before they can use the panel.
        </p>
        {loading ? (
          <p className="mt-4 text-sm text-panel-muted">Loading…</p>
        ) : (
          <label className="mt-4 flex items-center gap-3 text-sm text-white">
            <input
              type="checkbox"
              checked={requireClientTotp}
              onChange={(e) => setRequireClientTotp(e.target.checked)}
              className="h-4 w-4 rounded border-panel-border"
            />
            Require client TOTP on login
          </label>
        )}
        <Button className="mt-4" onClick={save} disabled={loading || saving}>
          {saving ? "Saving…" : "Save policy"}
        </Button>
      </Card>
      {error ? <Alert variant="error">{error}</Alert> : null}
      {success ? <Alert variant="success">{success}</Alert> : null}
    </div>
  );
}
