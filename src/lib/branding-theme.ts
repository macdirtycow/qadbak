/** Panel theme colors — resolved from presets on the server. */

export type BrandingThemeColors = {
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  cardColor: string;
  borderColor: string;
  mutedColor: string;
  textColor: string;
};

/** Omiiba / Qadbak unified stone gray (marketing, panel, license). */
export const DEFAULT_BRANDING_THEME: BrandingThemeColors = {
  primaryColor: "#e8e6e1",
  accentColor: "#d8d4cc",
  backgroundColor: "#0f0f0e",
  cardColor: "#1c1c1a",
  borderColor: "#2e2e2c",
  mutedColor: "#9c9892",
  textColor: "#eceae6",
};

/** Optional green preset (white-label). */
export const FOREST_BRANDING_THEME: BrandingThemeColors = {
  primaryColor: "#2ea872",
  accentColor: "#7dd3a8",
  backgroundColor: "#0c100e",
  cardColor: "#141a17",
  borderColor: "#2a3830",
  mutedColor: "#9caaa3",
  textColor: "#ece8e1",
};

/** Legacy blue preset (white-label option). */
export const OCEAN_BRANDING_THEME: BrandingThemeColors = {
  primaryColor: "#3b82f6",
  accentColor: "#5eead4",
  backgroundColor: "#0f1419",
  cardColor: "#1a2332",
  borderColor: "#2d3a4f",
  mutedColor: "#94a3b8",
  textColor: "#f1f5f9",
};

export function normalizeBrandingTheme(
  partial?: Partial<BrandingThemeColors> | null,
): BrandingThemeColors {
  const d = DEFAULT_BRANDING_THEME;
  const norm = (v: string | undefined, fallback: string) => {
    const c = String(v ?? "").trim();
    if (/^#[0-9a-fA-F]{6}$/.test(c)) return c.toLowerCase();
    if (/^#[0-9a-fA-F]{3}$/.test(c)) {
      const r = c[1];
      const g = c[2];
      const b = c[3];
      return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
    }
    return fallback;
  };
  return {
    primaryColor: norm(partial?.primaryColor, d.primaryColor),
    accentColor: norm(partial?.accentColor, d.accentColor),
    backgroundColor: norm(partial?.backgroundColor, d.backgroundColor),
    borderColor: norm(partial?.borderColor, d.borderColor),
    cardColor: norm(partial?.cardColor, d.cardColor),
    mutedColor: norm(partial?.mutedColor, d.mutedColor),
    textColor: norm(partial?.textColor, d.textColor),
  };
}
