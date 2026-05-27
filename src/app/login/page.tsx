"use client";

import { Alert, Button, Card, Input, Label } from "@/components/ui";
import { PanelFooter } from "@/components/PanelFooter";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";
import { applyBrandingToDocument } from "@/lib/branding-css";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [brandName, setBrandName] = useState(APP_NAME);
  const [tagline, setTagline] = useState(APP_TAGLINE);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [httpPanel, setHttpPanel] = useState(false);

  useEffect(() => {
    setHttpPanel(window.location.protocol === "http:");
    fetch("/api/branding")
      .then((r) => r.json())
      .then(
        (d: {
          brandName?: string;
          tagline?: string;
          logoUrl?: string;
          primaryColor?: string;
          accentColor?: string;
        }) => {
          if (d.brandName) setBrandName(d.brandName);
          if (d.tagline) setTagline(d.tagline);
          if (d.logoUrl) setLogoUrl(d.logoUrl);
          if (d.primaryColor && d.accentColor) {
            applyBrandingToDocument(d.primaryColor, d.accentColor);
          }
        },
      )
      .catch(() => {});
  }, []);

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
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="mx-auto mb-4 h-12 w-auto max-w-[200px]" />
        ) : null}
        <h1 className="text-2xl font-semibold text-white">{brandName}</h1>
        <p className="mt-1 text-sm text-panel-muted">{tagline}</p>
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
          Use the <strong className="text-slate-300">panel admin password</strong> from install (not the Linux{" "}
          <code className="text-slate-400">qadbak</code> system user). Dev mock: admin / changeme.
          {httpPanel ? (
            <>
              {" "}
              HTTP access (e.g. <code className="text-slate-400">:11000</code>) is supported — sign in works without
              HTTPS.
            </>
          ) : null}
        </p>
        <div className="mt-6">
          <PanelFooter showBlurb />
        </div>
      </Card>
    </div>
  );
}
