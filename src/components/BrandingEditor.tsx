"use client";

import { Alert, Button, Card, Input, Label } from "@/components/ui";
import { applyBrandingTheme } from "@/lib/branding-css";
import {
  BRANDING_PRESETS,
  colorsForThemeId,
  type BrandingThemeId,
} from "@/lib/branding-presets";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type BrandingState = {
  brandName: string;
  tagline: string;
  themeId: BrandingThemeId;
  logoUrl: string | null;
  isCustom: boolean;
};

export function BrandingEditor({ initial }: { initial: BrandingState }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(initial.logoUrl);

  const themeColors = useMemo(
    () => colorsForThemeId(form.themeId),
    [form.themeId],
  );

  useEffect(() => {
    applyBrandingTheme(themeColors);
  }, [themeColors]);

  async function save(payload: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/branding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as BrandingState & {
        error?: string;
        themeId?: BrandingThemeId;
      };
      if (!res.ok) throw new Error(data.error ?? "Save failed.");
      setForm({
        brandName: data.brandName,
        tagline: data.tagline,
        themeId: data.themeId ?? form.themeId,
        logoUrl: data.logoUrl ?? null,
        isCustom: data.isCustom,
      });
      setLogoPreview(data.logoUrl ?? null);
      if (data.themeId) {
        applyBrandingTheme(colorsForThemeId(data.themeId));
      }
      router.refresh();
      setSuccess("Branding saved - applies on login and across the panel.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  function saveAll() {
    if (!form.brandName.trim()) {
      setError("Company name is required.");
      return;
    }
    void save({
      brandName: form.brandName.trim(),
      tagline: form.tagline.trim(),
      themeId: form.themeId,
    });
  }

  function onLogoFile(file: File | null) {
    if (!file) return;
    if (!form.brandName.trim()) {
      setError("Enter a company name before uploading a logo.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      setLogoPreview(dataUrl);
      void save({
        brandName: form.brandName.trim(),
        tagline: form.tagline.trim(),
        themeId: form.themeId,
        logoBase64: dataUrl,
      });
    };
    reader.readAsDataURL(file);
  }

  function removeLogo() {
    setLogoPreview(null);
    void save({
      brandName: form.brandName.trim(),
      tagline: form.tagline.trim(),
      themeId: form.themeId,
      logoBase64: null,
    });
  }

  return (
    <Card>
      <h2 className="text-lg font-medium text-panel-text">Panel branding</h2>
      <p className="mt-2 text-sm text-panel-muted">
        Choose one of six themes, set your company name, and optionally upload a
        logo. Colors are fixed per theme so the panel stays readable and
        consistent.
      </p>
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

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="brand-name">Company name</Label>
          <Input
            id="brand-name"
            className="mt-1"
            value={form.brandName}
            onChange={(e) => setForm({ ...form, brandName: e.target.value })}
            placeholder="Your hosting company"
            required
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="tagline">Subtitle (optional)</Label>
          <Input
            id="tagline"
            className="mt-1"
            value={form.tagline}
            onChange={(e) => setForm({ ...form, tagline: e.target.value })}
            placeholder="Short line under your name on login"
          />
        </div>
      </div>

      <h3 className="mt-8 text-sm font-semibold text-panel-text">Theme</h3>
      <p className="mt-1 text-xs text-panel-muted">
        Click a theme to preview; save to apply for all users.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {BRANDING_PRESETS.map((preset) => {
          const selected = form.themeId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => setForm((f) => ({ ...f, themeId: preset.id }))}
              className={`rounded-xl border p-4 text-left transition ${
                selected
                  ? "border-panel-accent bg-panel-accent/10 ring-1 ring-panel-accent/40"
                  : "border-panel-border bg-panel-card/40 hover:border-panel-muted"
              }`}
            >
              <div className="flex gap-2">
                <span
                  className="h-8 w-8 shrink-0 rounded-lg border border-white/10"
                  style={{ backgroundColor: preset.colors.primaryColor }}
                  aria-hidden
                />
                <span
                  className="h-8 w-8 shrink-0 rounded-lg border border-white/10"
                  style={{ backgroundColor: preset.colors.accentColor }}
                  aria-hidden
                />
                <span
                  className="h-8 flex-1 rounded-lg border border-white/10"
                  style={{ backgroundColor: preset.colors.backgroundColor }}
                  aria-hidden
                />
              </div>
              <p className="mt-3 font-medium text-panel-text">{preset.name}</p>
              <p className="mt-0.5 text-xs text-panel-muted">
                {preset.description}
              </p>
              {selected ? (
                <p className="mt-2 text-xs font-medium text-panel-link">
                  Selected
                </p>
              ) : null}
            </button>
          );
        })}
      </div>

      <div
        className="mt-8 overflow-hidden rounded-xl border border-panel-border"
        aria-label="Panel theme preview"
      >
        <div className="border-b border-panel-border bg-panel-card/80 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-panel-muted">
            Live preview - {BRANDING_PRESETS.find((p) => p.id === form.themeId)?.name}
          </p>
        </div>
        <div className="bg-panel-bg p-4">
          <div className="overflow-hidden rounded-lg border border-panel-border bg-panel-card">
            <div className="flex items-center gap-3 border-b border-panel-border px-4 py-3">
              {logoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoPreview}
                  alt=""
                  className="h-8 w-auto max-w-[100px] object-contain"
                />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-panel-accent/25 text-sm">
                  ◆
                </span>
              )}
              <span className="font-semibold text-panel-text">
                {form.brandName.trim() || "Company name"}
              </span>
              <nav className="ml-auto flex gap-1">
                <span className="rounded-lg bg-panel-accent/20 px-2 py-1 text-xs text-panel-text">
                  Active
                </span>
                <span className="rounded-lg px-2 py-1 text-xs text-panel-muted">
                  Domains
                </span>
              </nav>
            </div>
            <div className="space-y-3 p-4">
              {form.tagline ? (
                <p className="text-sm text-panel-muted">{form.tagline}</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button type="button" className="text-sm">
                  Primary
                </Button>
                <Button type="button" variant="secondary" className="text-sm">
                  Secondary
                </Button>
                <span className="self-center text-sm text-panel-link">Link</span>
              </div>
              <Input placeholder="Sample input field" className="max-w-xs" />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <Label htmlFor="logo">Logo (PNG / JPEG / WebP)</Label>
        <Input
          id="logo"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="mt-1"
          disabled={busy}
          onChange={(e) => onLogoFile(e.target.files?.[0] ?? null)}
        />
        <p className="mt-1 text-xs text-panel-muted">
          Shown in the header and on the login page. Recommended: wide logo on
          transparent background, max height ~48px.
        </p>
        {logoPreview ? (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoPreview}
              alt="Logo preview"
              className="h-12 w-auto max-w-[200px] object-contain"
            />
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={removeLogo}
            >
              Remove logo
            </Button>
          </div>
        ) : null}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button disabled={busy} onClick={saveAll}>
          {busy ? "Saving…" : "Save branding"}
        </Button>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => save({ reset: true })}
        >
          Reset to Qadbak default
        </Button>
      </div>
    </Card>
  );
}
