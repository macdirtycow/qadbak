"use client";

import { Alert, Button, Card, Input, Label } from "@/components/ui";
import { PanelFooter } from "@/components/PanelFooter";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";
import Link from "next/link";
import { useState } from "react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ username, password }),
      });
      let data: { error?: string } = {};
      try {
        data = await res.json();
      } catch {
        setError("Server returned an invalid response. Is the app running?");
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "Sign-in failed.");
        return;
      }
      // Full navigation ensures session cookie is applied (Brave / npm start + Secure fix)
      window.location.assign("/dashboard");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <p className="mb-4 text-center text-sm">
          <Link href="/" className="text-panel-muted hover:text-white">
            ← Back to home
          </Link>
        </p>
        <h1 className="text-2xl font-semibold text-white">{APP_NAME}</h1>
        <p className="mt-1 text-sm text-panel-muted">{APP_TAGLINE}</p>
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          {error && <Alert>{error}</Alert>}
          <div>
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <p className="mt-6 text-xs text-panel-muted">
          Default: <strong className="text-slate-300">admin</strong> / <strong className="text-slate-300">changeme</strong> (or client / changeme).
          Local: <code className="text-slate-400">VIRTUALMIN_MOCK=true</code> and{" "}
          <code className="text-slate-400">QADBAK_COOKIE_SECURE=false</code> in .env.local, then restart the server.
        </p>
        <div className="mt-6">
          <PanelFooter showBlurb />
        </div>
      </Card>
    </div>
  );
}
