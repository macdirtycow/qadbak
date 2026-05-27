"use client";

import { Alert, Button, Card, Input, Label } from "@/components/ui";
import { useCallback, useEffect, useState } from "react";

export function DomainPanelClientCard({ domain }: { domain: string }) {
  const enc = encodeURIComponent(domain);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [username, setUsername] = useState("");
  const [suggestedUsername, setSuggestedUsername] = useState("");
  const [panelUrl, setPanelUrl] = useState("");
  const [vhostConfigured, setVhostConfigured] = useState(false);
  const [hasClient, setHasClient] = useState(false);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/domains/${enc}/panel-client`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load panel client.");
      setSuggestedUsername(data.suggestedUsername ?? "");
      setUsername(data.client?.username ?? data.suggestedUsername ?? "");
      setHasClient(!!data.client);
      setPanelUrl(data.panelUrl ?? "");
      setVhostConfigured(!!data.vhostConfigured);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(false);
    }
  }, [enc]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveClient() {
    if (password && password.length < 8) {
      setError("Custom password must be at least 8 characters.");
      return;
    }
    if (password && password !== password2) {
      setError("Passwords do not match.");
      return;
    }
    setActing("client");
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/admin/domains/${enc}/panel-client`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upsert-client",
          password: password || undefined,
          username: username.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed.");
      const shownPass = data.password as string | undefined;
      setSuccess(
        data.created
          ? shownPass
            ? `Client ${data.username} created. Password (copy now): ${shownPass}`
            : `Client ${data.username} created. Login: ${data.panelUrl}`
          : shownPass
            ? `Password updated for ${data.username}. New password (copy now): ${shownPass}`
            : `Password updated for ${data.username}.`,
      );
      setPassword("");
      setPassword2("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setActing(null);
    }
  }

  async function applyVhost() {
    setActing("vhost");
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/admin/domains/${enc}/panel-client`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "apply-vhost" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Vhost failed.");
      setSuccess(`Nginx vhost applied for ${panelUrl}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setActing(null);
    }
  }

  return (
    <Card>
      <h2 className="text-lg font-medium text-white">Client panel access</h2>
      <p className="mt-1 text-sm text-panel-muted">
        Login for the customer at{" "}
        <code className="text-xs">panel.{domain}</code> (separate from unix/FTP
        password).
      </p>

      {loading && (
        <p className="mt-4 text-sm text-panel-muted">Loading…</p>
      )}
      {error && (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      )}
      {success && (
        <div className="mt-4">
          <Alert variant="success">{success}</Alert>
        </div>
      )}

      {!loading && (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-panel-muted">
            Status:{" "}
            {hasClient ? (
              <span className="text-emerald-400">
                client <strong className="text-white">{username}</strong> exists
              </span>
            ) : (
              <span className="text-amber-400">no panel client yet</span>
            )}
            {" · "}
            vhost:{" "}
            {vhostConfigured ? (
              <span className="text-emerald-400">configured</span>
            ) : (
              <span className="text-amber-400">not configured</span>
            )}
          </p>

          <div>
            <Label htmlFor="panel-user">Panel username</Label>
            <Input
              id="panel-user"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={suggestedUsername}
              disabled={hasClient}
            />
            {!hasClient && (
              <p className="mt-1 text-xs text-panel-muted">
                Default from domain: {suggestedUsername}
              </p>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="panel-pass">
                Panel password {hasClient ? "" : "(optional)"}
              </Label>
              <Input
                id="panel-pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder={
                  hasClient ? "Min. 8 characters" : "Leave empty to auto-generate"
                }
              />
            </div>
            <div>
              <Label htmlFor="panel-pass2">Confirm</Label>
              <Input
                id="panel-pass2"
                type="password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                autoComplete="new-password"
                placeholder={hasClient ? "" : "Only if you set a custom password"}
                disabled={!hasClient && !password}
              />
            </div>
          </div>
          {!hasClient && (
            <p className="text-xs text-panel-muted">
              You do not need to enter a password — one is generated and shown once after
              you click Create client account.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              disabled={acting !== null}
              onClick={saveClient}
            >
              {acting === "client"
                ? "Saving…"
                : hasClient
                  ? "Reset password"
                  : "Create client account"}
            </Button>
            <Button
              variant="secondary"
              disabled={acting !== null || vhostConfigured}
              onClick={applyVhost}
            >
              {acting === "vhost" ? "…" : "Apply panel vhost"}
            </Button>
          </div>

          {panelUrl && (
            <p className="text-sm text-panel-muted">
              URL:{" "}
              <a
                href={panelUrl}
                className="text-panel-link hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                {panelUrl}
              </a>
              {" "}
              — with native DNS on this server, the{" "}
              <code>panel.{domain}</code> A-record and HTTPS are applied
              automatically when you click Apply panel vhost.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
