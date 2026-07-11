import type { StoredLicense } from "../qadbak-license";
import { ALL_PREMIUM_FEATURES } from "./features";

/**
 * Feature list used for gating and env sync.
 *
 * Pro/enterprise/evaluation licenses include the full Premium catalog even
 * when the license server's stored feature array lags (e.g. webmail-ui added
 * after the key was issued). Starter keeps the explicit server-side list.
 */
export function effectivePremiumFeatures(
  stored: StoredLicense | null,
): string[] {
  if (!stored) return [];
  const base = stored.features ?? [];
  if (stored.plan === "starter") return base;
  return [...new Set([...base, ...ALL_PREMIUM_FEATURES])];
}
