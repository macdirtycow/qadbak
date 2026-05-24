import { PremiumRequiredError } from "@/lib/premium/types";

export function premiumLibUnavailable(feature: string): never {
  throw new PremiumRequiredError(
    feature,
    "Premium module not loaded. Activate license and run: node scripts/qadbak-license-cli.mjs sync",
  );
}
