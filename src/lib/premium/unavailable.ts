import { PremiumRequiredError } from "@/lib/premium/types";

/**
 * Stub thrown by the placeholder implementations under `src/lib/`
 * (panel-vhost, panel-pm2, panel-client-admin, updates-helper) until
 * their real open-core Premium counterparts land under
 * `src/lib/premium/*`. Surfaces as a 503 PREMIUM_REQUIRED to the panel
 * UI, identical to the gate `requirePremiumFeature` enforces upstream.
 */
export function premiumLibUnavailable(feature: string): never {
  throw new PremiumRequiredError(
    feature,
    `Premium ${feature} module is not yet available in this build. Activate your license under Server admin → License if you have not already; the implementation lands in the public open-core repo.`,
  );
}
