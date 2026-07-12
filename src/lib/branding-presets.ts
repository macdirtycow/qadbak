import {
  DEFAULT_BRANDING_THEME,
  FOREST_BRANDING_THEME,
  OCEAN_BRANDING_THEME,
  type BrandingThemeColors,
} from "@/lib/branding-theme";

export type BrandingThemeId =
  | "ocean"
  | "emerald"
  | "violet"
  | "slate"
  | "sunset"
  | "rose";

export type BrandingPreset = {
  id: BrandingThemeId;
  name: string;
  description: string;
  colors: BrandingThemeColors;
};

export const BRANDING_PRESETS: BrandingPreset[] = [
  {
    id: "slate",
    name: "Stone",
    description: "Cool slate gray — Inveil / Qadbak default",
    colors: DEFAULT_BRANDING_THEME,
  },
  {
    id: "emerald",
    name: "Forest",
    description: "Green accent — alternate",
    colors: FOREST_BRANDING_THEME,
  },
  {
    id: "ocean",
    name: "Ocean",
    description: "Blue and teal — alternate",
    colors: OCEAN_BRANDING_THEME,
  },
  {
    id: "violet",
    name: "Violet",
    description: "Modern purple accent",
    colors: {
      primaryColor: "#8b5cf6",
      accentColor: "#c4b5fd",
      backgroundColor: "#100f18",
      cardColor: "#1a1828",
      borderColor: "#2e2a42",
      mutedColor: "#a1a1aa",
      textColor: "#f5f3ff",
    },
  },
  {
    id: "sunset",
    name: "Sunset",
    description: "Warm amber on dark",
    colors: {
      primaryColor: "#f59e0b",
      accentColor: "#fcd34d",
      backgroundColor: "#14110c",
      cardColor: "#1f1a14",
      borderColor: "#3d3424",
      mutedColor: "#a8a29e",
      textColor: "#fffbeb",
    },
  },
  {
    id: "rose",
    name: "Rose",
    description: "Bold red-pink accent",
    colors: {
      primaryColor: "#f43f5e",
      accentColor: "#fda4af",
      backgroundColor: "#140c0f",
      cardColor: "#1f1418",
      borderColor: "#3d2430",
      mutedColor: "#a1a1aa",
      textColor: "#fff1f2",
    },
  },
];

export const DEFAULT_BRANDING_THEME_ID: BrandingThemeId = "slate";

const PRESET_BY_ID = new Map(
  BRANDING_PRESETS.map((p) => [p.id, p] as const),
);

export function isBrandingThemeId(id: string): id is BrandingThemeId {
  return PRESET_BY_ID.has(id as BrandingThemeId);
}

export function getBrandingPreset(id: string | undefined | null): BrandingPreset {
  const key = String(id ?? "").trim();
  if (isBrandingThemeId(key)) return PRESET_BY_ID.get(key)!;
  return PRESET_BY_ID.get(DEFAULT_BRANDING_THEME_ID)!;
}

/** Map legacy custom hex branding to the closest preset (for migration). */
export function inferThemeIdFromColors(
  partial?: Partial<BrandingThemeColors> | null,
): BrandingThemeId {
  const primary = String(partial?.primaryColor ?? "")
    .trim()
    .toLowerCase();
  if (!primary) return DEFAULT_BRANDING_THEME_ID;

  for (const preset of BRANDING_PRESETS) {
    if (preset.colors.primaryColor.toLowerCase() === primary) {
      return preset.id;
    }
  }
  if (primary === "#2ea872" || primary === "#10b981" || primary === "#34d399") {
    return "emerald";
  }
  if (primary === "#3b82f6") return "ocean";
  if (
    primary === "#e8e6e1" ||
    primary === "#e8ecf4" ||
    primary === "#64748b"
  ) {
    return "slate";
  }
  return DEFAULT_BRANDING_THEME_ID;
}

export function colorsForThemeId(
  themeId: string | undefined | null,
): BrandingThemeColors {
  return getBrandingPreset(themeId).colors;
}
