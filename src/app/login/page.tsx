"use client";

import { Alert, Button, Card, Input, Label } from "@/components/ui";
import { PanelFooter } from "@/components/PanelFooter";
import { APP_NAME, APP_TAGLINE, DEFAULT_LOGO_PATH } from "@/lib/brand";
import { applyBrandingTheme } from "@/lib/branding-css";
import type { BrandingThemeColors } from "@/lib/branding-theme";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsTotp, setNeedsTotp] = useState(false);
  const [loginToken, setLoginToken] = useState("");
  const [totp, setTotp] = useState("");
  const [brandName, setBrandName] = useState(APP_NAME);
  const [tagline, setTagline] = useState(APP_TAGLINE);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [httpPanel, setHttpPanel] = useState(false);
  const [demoInfo, setDemoInfo] = useState<{
    username?: string;
    password?: string;
    readOnly?: boolean;
    showcaseDomain?: string;
  } | null>(null);

  useEffect(() => {
    setHttpPanel(window.location.protocol === "http:");
    fetch("/api/demo/info")
      .then((r) => r.json())
      .then((d: { demo?: boolean; username?: string; password?: string; readOnly?: boolean; showcaseDomain?: string }) => {
        if (d.demo) {
          setDemoInfo(d);
          setUsername(d.username ?? "");
          setPassword(d.password ?? "");
        }
      })
      .catch(() => {});
    fetch("/api/branding")
      .then((r) => r.json())
      .then(
        (d: {
          brandName?: string;
          tagline?: string;
          logoUrl?: string;
        } & Partial<BrandingThemeColors>) => {
          if (d.brandName) setBrandName(d.brandName);
          if (d.tagline) setTagline(d.tagline);
          if (d.logoUrl) setLogoUrl(d.logoUrl);
          applyBrandingTheme(d);
        },
      )
      .catch(() => {});
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const body = needsTotp
        ? { loginToken, totp: totp.trim() }
        : { username, password };
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });
      let data: { error?: string; requiresTotp?: boolean; loginToken?: string } =
        {};
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
      if (data.requiresTotp && data.loginToken) {
        setNeedsTotp(true);
        setLoginToken(data.loginToken);
        setError("");
        return;
      }
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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl ?? DEFAULT_LOGO_PATH}
          alt=""
          className={
            logoUrl
              ? "mx-auto mb-4 h-12 w-auto max-w-[200px]"
              : "mx-auto mb-4 h-12 w-12"
          }
        />
        <h1 className="text-2xl font-semibold text-panel-text">{brandName}</h1>
        <p className="mt-1 text-sm text-panel-muted">{tagline}</p>
        {demoInfo ? (
          <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-50">
            <p className="font-medium">Live demo (read-only)</p>
            <p className="mt-1 text-amber-100/90">
              Credentials are prefilled. Explore domains, mail, Site tools, and server admin —
              changes are blocked. Sample domain:{" "}
              <code className="text-amber-50">{demoInfo.showcaseDomain ?? "showcase.qadbak.com"}</code>
            </p>
          </div>
        ) : null}
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          {error && <Alert>{error}</Alert>}
          {!needsTotp && (
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
          )}
          {!needsTotp ? (
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
          ) : (
            <div>
              <Label htmlFor="totp">Authenticator code</Label>
              <Input
                id="totp"
                name="totp"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={totp}
                onChange={(e) => setTotp(e.target.value)}
                placeholder="6-digit code"
                required
              />
              <button
                type="button"
                className="mt-2 text-xs text-panel-link hover:underline"
                onClick={() => {
                  setNeedsTotp(false);
                  setLoginToken("");
                  setTotp("");
                }}
              >
                ← Back to password
              </button>
            </div>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading
              ? "Signing in…"
              : needsTotp
                ? "Verify code"
                : "Sign in"}
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
