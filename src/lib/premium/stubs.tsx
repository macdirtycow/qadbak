import Link from "next/link";
import { Alert, Card } from "@/components/ui";
import { ALL_PREMIUM_FEATURES } from "@/lib/premium/features";

export function PremiumUpgradeCard({
  feature,
  title = "Premium feature",
  premiumActive = false,
  licensedFeatures = [],
  verifyError,
}: {
  feature: string;
  title?: string;
  premiumActive?: boolean;
  licensedFeatures?: string[];
  verifyError?: string;
}) {
  const hasFeature = licensedFeatures.includes(feature);

  return (
    <Card className="border-amber-500/30 bg-amber-950/20">
      <h2 className="text-lg font-medium text-white">{title}</h2>
      <div className="mt-4">
        <Alert>
          {!premiumActive
            ? `Premium is not active on this panel${verifyError ? `: ${verifyError}` : ""}. Open License → Activate → Heartbeat now.`
            : !hasFeature
              ? `License is active but "${feature}" is not in your feature list. Enable it in license admin, then Heartbeat now.`
              : `This feature (${feature}) requires a Qadbak Premium license.`}
        </Alert>
      </div>
      {licensedFeatures.length > 0 && (
        <p className="mt-3 text-sm text-panel-muted">
          Licensed modules: {licensedFeatures.join(", ")}
        </p>
      )}
      <p className="mt-4 text-sm text-panel-muted">
        License server: check <strong className="text-white">{feature}</strong> on your key
        (June plan modules: {ALL_PREMIUM_FEATURES.join(", ")}). Then{" "}
        <Link href="/admin/license" className="text-panel-link hover:underline">
          Server admin → License
        </Link>{" "}
        → <strong className="text-white">Heartbeat now</strong>. On the VPS:{" "}
        <code className="text-slate-400">sudo bash scripts/repair-panel-premium.sh</code>
      </p>
    </Card>
  );
}

export function PremiumNavLock() {
  return (
    <span className="ml-1 text-xs text-amber-400" title="Premium">
      🔒
    </span>
  );
}
