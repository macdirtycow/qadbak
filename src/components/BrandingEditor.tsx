"use client";

import { Alert, Button, Card, Input, Label } from "@/components/ui";
import { applyBrandingToDocument } from "@/lib/branding-css";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type BrandingState = {
  brandName: string;
  tagline: string;
  primaryColor: string;
  accentColor: string;
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

  useEffect(() => {
    applyBrandingToDocument(form.primaryColor, form.accentColor);
  }, [form.primaryColor, form.accentColor]);

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
      const data = (await res.json()) as BrandingState & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Save failed.");
      setForm(data);
      setLogoPreview(data.logoUrl);
      applyBrandingToDocument(data.primaryColor, data.accentColor);
      router.refresh();
      setSuccess("Branding saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  function onLogoFile(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      setLogoPreview(dataUrl);
      void save({
        brandName: form.brandName,
        tagline: form.tagline,
        primaryColor: form.primaryColor,
        accentColor: form.accentColor,
        logoBase64: dataUrl,
      });
    };
    reader.readAsDataURL(file);
  }

  return (
    <Card>
      <h2 className="text-lg font-medium text-white">Panel branding</h2>
      <p className="mt-2 text-sm text-panel-muted">
        Customize login and panel header for your customers (Premium white-label).
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
        <div>
          <Label htmlFor="brand-name">Brand name</Label>
          <Input
            id="brand-name"
            className="mt-1"
            value={form.brandName}
            onChange={(e) => setForm({ ...form, brandName: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="tagline">Tagline</Label>
          <Input
            id="tagline"
            className="mt-1"
            value={form.tagline}
            onChange={(e) => setForm({ ...form, tagline: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="primary">Primary color</Label>
          <Input
            id="primary"
            type="color"
            className="mt-1 h-10 w-full"
            value={form.primaryColor}
            onChange={(e) =>
              setForm({ ...form, primaryColor: e.target.value })
            }
          />
          <p className="mt-1 text-xs text-panel-muted">Buttons and nav highlights</p>
        </div>
        <div>
          <Label htmlFor="accent">Accent color</Label>
          <Input
            id="accent"
            type="color"
            className="mt-1 h-10 w-full"
            value={form.accentColor}
            onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
          />
          <p className="mt-1 text-xs text-panel-muted">Links and focus rings</p>
        </div>
      </div>
      <div
        className="mt-4 rounded-lg border border-panel-border p-4"
        aria-label="Color preview"
      >
        <p className="text-xs font-medium uppercase tracking-wide text-panel-muted">
          Live preview
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button type="button">Primary button</Button>
          <Button type="button" variant="secondary">
            Secondary
          </Button>
          <span className="text-sm text-panel-link">Sample link</span>
          <span className="rounded-full bg-panel-accent/20 px-2 py-0.5 text-xs text-white">
            Nav highlight
          </span>
        </div>
      </div>
      <div className="mt-4">
        <Label htmlFor="logo">Logo (PNG)</Label>
        <Input
          id="logo"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="mt-1"
          disabled={busy}
          onChange={(e) => onLogoFile(e.target.files?.[0] ?? null)}
        />
        {logoPreview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoPreview}
            alt="Logo preview"
            className="mt-3 h-12 w-auto max-w-[200px] object-contain"
          />
        ) : null}
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        <Button
          disabled={busy}
          onClick={() =>
            save({
              brandName: form.brandName,
              tagline: form.tagline,
              primaryColor: form.primaryColor,
              accentColor: form.accentColor,
            })
          }
        >
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
