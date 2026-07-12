import "server-only";
import { isPremiumActive, readStoredLicense } from "../qadbak-license";
import { effectivePremiumFeatures } from "./effective-features";

export { effectivePremiumFeatures } from "./effective-features";

/** Dev/CI only — production panels must use a valid license heartbeat. */
function envPremiumOverrideAllowed(): boolean {
  if (process.env.QADBAK_ALLOW_DEV_LICENSE === "true") return true;
  if (process.env.QADBAK_LEGACY_API_MOCK === "true") return true;
  if (process.env.NODE_ENV === "development") return true;
  if (process.env.NODE_ENV === "test") return true;
  return false;
}

/**
 * Single source of truth for Premium feature gating.
 *
 * A feature is enabled iff:
 *
 *   1. `QADBAK_PREMIUM_FEATURES` env override lists it (dev/CI only), OR
 *   2. The local license cache is active (valid heartbeat, not revoked)
 *      AND the effective license feature list grants this feature.
 *
 * Non-starter plans use {@link effectivePremiumFeatures} so older keys
 * missing newly shipped modules (e.g. webmail-ui) still unlock the catalog.
 */
export async function isPremiumFeatureEnabled(
  feature: string,
): Promise<boolean> {
  const envFeatures =
    process.env.QADBAK_PREMIUM_FEATURES?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];
  if (envFeatures.includes(feature) && envPremiumOverrideAllowed()) return true;
  if (!(await isPremiumActive())) return false;
  const stored = await readStoredLicense();
  return effectivePremiumFeatures(stored).includes(feature);
}
