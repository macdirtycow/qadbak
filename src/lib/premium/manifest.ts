import manifest from "../../../premium.manifest.json";

export type PremiumFeatureId = keyof typeof manifest.features;

export interface PremiumManifest {
  version: string;
  features: Record<
    string,
    { label: string; description: string }
  >;
  routes: Record<string, PremiumFeatureId>;
  modules: Record<PremiumFeatureId, string>;
  handlers: Record<string, string>;
  components: Record<string, string>;
}

export const PREMIUM_MANIFEST = manifest as PremiumManifest;

export function featureForRoute(pathname: string): PremiumFeatureId | null {
  for (const [pattern, feature] of Object.entries(PREMIUM_MANIFEST.routes)) {
    if (pattern.includes("*")) {
      const re = new RegExp(
        `^${pattern.replace(/\*/g, "[^/]+").replace(/\//g, "\\/")}$`,
      );
      if (re.test(pathname)) return feature as PremiumFeatureId;
    } else if (pathname === pattern || pathname.startsWith(`${pattern}/`)) {
      return feature as PremiumFeatureId;
    }
  }
  return null;
}

export function isPremiumNavPath(path: string): boolean {
  return path === "/admin/updates";
}

export function premiumFeatureForNavPath(path: string): PremiumFeatureId | null {
  if (path === "/admin/updates") return "admin-updates";
  return null;
}
