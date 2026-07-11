import "server-only";
import { isPremiumActive, readStoredLicense } from "../qadbak-license";
import { effectivePremiumFeatures } from "./effective-features";

export { effectivePremiumFeatures } from "./effective-features";

/**
 * Single source of truth for Premium feature gating.
 *
 * Open-core model: Premium source ships in the public macdirtycow/qadbak
 * repo (same as Discourse, GitLab, Sentry, Mattermost, Cal.com). A
 * feature is enabled iff:
 *
 *   1. `QADBAK_PREMIUM_FEATURES` env override lists it (dev/CI shortcut), OR
 *   2. The local license cache is active (valid heartbeat, not revoked)
 *      AND the effective license feature list grants this feature.
 *
 * Non-starter plans use {@link effectivePremiumFeatures} so older keys
 * missing newly shipped modules (e.g. webmail-ui) still unlock the catalog.
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
  return effectivePremiumFeatures(stored).includes(feature);
}
