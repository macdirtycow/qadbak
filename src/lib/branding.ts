import "server-only";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";
import {
  DEFAULT_ACCENT,
  DEFAULT_PRIMARY,
  brandingCssVars as buildBrandingCssVars,
} from "@/lib/branding-css";

const DATA_DIR = path.join(process.cwd(), "data");
const BRANDING_JSON = path.join(DATA_DIR, "branding.json");
const BRANDING_DIR = path.join(DATA_DIR, "branding");
const LOGO_FILE = path.join(BRANDING_DIR, "logo.png");

export type PanelBranding = {
  brandName: string;
  tagline: string;
  primaryColor: string;
  accentColor: string;
  hasLogo: boolean;
};

export type PanelBrandingInput = {
  brandName?: string;
  tagline?: string;
  primaryColor?: string;
  accentColor?: string;
  logoBase64?: string | null;
  reset?: boolean;
};

type StoredBranding = {
  brandName?: string;
  tagline?: string;
  primaryColor?: string;
  accentColor?: string;
};

function normalizeHex(color: string | undefined, fallback: string): string {
  const c = String(color ?? "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(c)) return c.toLowerCase();
  return fallback;
}

export async function loadPanelBranding(): Promise<PanelBranding | null> {
  try {
    const raw = await readFile(BRANDING_JSON, "utf8");
    const data = JSON.parse(raw) as StoredBranding;
    if (!data.brandName?.trim()) return null;
    let hasLogo = false;
    try {
      await readFile(LOGO_FILE);
      hasLogo = true;
    } catch {
      hasLogo = false;
    }
    return {
      brandName: data.brandName.trim(),
      tagline: (data.tagline ?? APP_TAGLINE).trim(),
      primaryColor: normalizeHex(data.primaryColor, DEFAULT_PRIMARY),
      accentColor: normalizeHex(data.accentColor, DEFAULT_ACCENT),
      hasLogo,
    };
  } catch {
    return null;
  }
}

export function displayBranding(
  stored: PanelBranding | null,
): PanelBranding & { isCustom: boolean } {
  if (!stored) {
    return {
      brandName: APP_NAME,
      tagline: APP_TAGLINE,
      primaryColor: DEFAULT_PRIMARY,
      accentColor: DEFAULT_ACCENT,
      hasLogo: false,
      isCustom: false,
    };
  }
  return { ...stored, isCustom: true };
}

export function brandingCssVars(b: PanelBranding): string {
  return buildBrandingCssVars(b.primaryColor, b.accentColor);
}

export async function savePanelBranding(
  input: PanelBrandingInput,
): Promise<PanelBranding | null> {
  if (input.reset) {
    await rm(BRANDING_JSON, { force: true });
    await rm(LOGO_FILE, { force: true });
    return null;
  }
  await mkdir(BRANDING_DIR, { recursive: true });
  const existing = (await loadPanelBranding()) ?? {
    brandName: APP_NAME,
    tagline: APP_TAGLINE,
    primaryColor: DEFAULT_PRIMARY,
    accentColor: DEFAULT_ACCENT,
    hasLogo: false,
  };
  const next: StoredBranding = {
    brandName: (input.brandName ?? existing.brandName).trim() || APP_NAME,
    tagline: (input.tagline ?? existing.tagline).trim() || APP_TAGLINE,
    primaryColor: normalizeHex(input.primaryColor, existing.primaryColor),
    accentColor: normalizeHex(input.accentColor, existing.accentColor),
  };
  await writeFile(BRANDING_JSON, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  if (input.logoBase64 === null) {
    await rm(LOGO_FILE, { force: true });
  } else if (input.logoBase64?.startsWith("data:image/")) {
    const b64 = input.logoBase64.replace(/^data:image\/\w+;base64,/, "");
    await writeFile(LOGO_FILE, Buffer.from(b64, "base64"));
  }
  return loadPanelBranding();
}

export function logoPublicPath(hasLogo: boolean): string | null {
  return hasLogo ? "/api/branding/logo" : null;
}
