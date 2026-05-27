/** Shared branding CSS (safe for client + server). */

export const DEFAULT_PRIMARY = "#3b82f6";
export const DEFAULT_ACCENT = "#5eead4";

export function hexToRgbChannels(hex: string): string | null {
  const c = String(hex || "").trim();
  let m = c.match(/^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/);
  if (m) {
    return `${parseInt(m[1], 16)} ${parseInt(m[2], 16)} ${parseInt(m[3], 16)}`;
  }
  m = c.match(/^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/);
  if (m) {
    const r = parseInt(m[1] + m[1], 16);
    const g = parseInt(m[2] + m[2], 16);
    const b = parseInt(m[3] + m[3], 16);
    return `${r} ${g} ${b}`;
  }
  return null;
}

export function brandingCssVars(
  primaryColor: string,
  accentColor: string,
): string {
  const primaryRgb =
    hexToRgbChannels(primaryColor) ?? hexToRgbChannels(DEFAULT_PRIMARY)!;
  const accentRgb =
    hexToRgbChannels(accentColor) ?? hexToRgbChannels(DEFAULT_ACCENT)!;
  return `:root{
  --brand-primary:${primaryColor};
  --brand-accent:${accentColor};
  --brand-primary-rgb:${primaryRgb};
  --brand-accent-rgb:${accentRgb};
}`;
}

export function applyBrandingToDocument(
  primaryColor: string,
  accentColor: string,
): void {
  if (typeof document === "undefined") return;
  let el = document.getElementById("qadbak-branding");
  if (!el) {
    el = document.createElement("style");
    el.id = "qadbak-branding";
    document.head.appendChild(el);
  }
  el.textContent = brandingCssVars(primaryColor, accentColor);
}
