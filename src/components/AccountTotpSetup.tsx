"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Card, Input, Label } from "@/components/ui";

export function AccountTotpSetup() {
  const [enabled, setEnabled] = useState(false);
  const [setupSecret, setSetupSecret] = useState("");
  const [otpauthUrl, setOtpauthUrl] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/auth/totp");
    const data = (await res.json()) as { enabled?: boolean; error?: string };
    if (!res.ok) throw new Error(data.error ?? "Load failed");
    setEnabled(Boolean(data.enabled));
  }, []);

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Error"));
  }, [load]);

  async function beginSetup() {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/auth/totp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "begin-setup" }),
      });
      const data = (await res.json()) as {
        secret?: string;
        otpauthUrl?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Setup failed");
      setSetupSecret(data.secret ?? "");
      setOtpauthUrl(data.otpauthUrl ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function enable() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/totp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "enable",
          secret: setupSecret,
          code: code.trim(),
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Enable failed");
      setSetupSecret("");
      setOtpauthUrl("");
      setCode("");
      setEnabled(true);
      setSuccess("Two-factor authentication is now enabled.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/totp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "disable",
          code: code.trim(),
          password,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Disable failed");
      setEnabled(false);
      setCode("");
      setPassword("");
      setSuccess("Two-factor authentication disabled.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && <Alert>{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <Card>
        <h2 className="text-lg font-medium text-white">Authenticator app (TOTP)</h2>
        <p className="mt-2 text-sm text-panel-muted">
          Compatible with Google Authenticator, Authy, 1Password, and other TOTP apps.
          Codes stay on your device — Qadbak never receives them except during login.
        </p>
        <p className="mt-2 text-sm text-panel-muted">
          Status:{" "}
          <span className="text-white">{enabled ? "Enabled" : "Not enabled"}</span>
        </p>

        {!enabled && !setupSecret && (
          <Button className="mt-4" onClick={() => void beginSetup()} disabled={busy}>
            Set up two-factor
          </Button>
        )}

        {setupSecret && (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-panel-muted">
              Scan this URL in your app or enter the secret manually:
            </p>
            <p className="break-all font-mono text-xs text-white">{setupSecret}</p>
            <a
              href={otpauthUrl}
              className="text-sm text-panel-link hover:underline"
            >
              Open in authenticator app
            </a>
            <div>
              <Label htmlFor="totp-code">6-digit code</Label>
              <Input
                id="totp-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="000000"
              />
            </div>
            <Button onClick={() => void enable()} disabled={busy || code.length < 6}>
              Confirm and enable
            </Button>
          </div>
        )}

        {enabled && (
          <div className="mt-4 space-y-4 border-t border-panel-border pt-4">
            <p className="text-sm text-panel-muted">
              To disable 2FA, enter your panel password and a current code.
            </p>
            <div>
              <Label htmlFor="totp-pw">Password</Label>
              <Input
                id="totp-pw"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="totp-off">Authenticator code</Label>
              <Input
                id="totp-off"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            <Button variant="secondary" onClick={() => void disable()} disabled={busy}>
              Disable two-factor
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
