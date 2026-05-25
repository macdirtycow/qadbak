import "server-only";
import { isPremiumActive, readStoredLicense } from "../qadbak-license";

/**
 * Single source of truth for Premium feature gating.
 *
 * Open-core model: Premium source ships in the public macdirtycow/qadbak
 * repo (same as Discourse, GitLab, Sentry, Mattermost, Cal.com). A
 * feature is enabled iff:
 *
 *   1. `QADBAK_PREMIUM_FEATURES` env override lists it (dev/CI shortcut), OR
 *   2. The local license cache is active (valid heartbeat, not revoked)
 *      AND the license's feature list grants this feature.
 *
 * No artifact downloads, no on-disk sync state, no `data/premium/active.json`.
 */
export async function isPremiumFeatureEnabled(
  feature: string,
): Promise<boolean> {
  const envFeatures =
    process.env.QADBAK_PREMIUM_FEATURES?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];
  if (envFeatures.includes(feature)) return true;
  if (!(await isPremiumActive())) return false;
  const stored = await readStoredLicense();
  return stored?.features.includes(feature) === true;
}
