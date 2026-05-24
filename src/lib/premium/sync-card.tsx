import Link from "next/link";
import { Alert, Card } from "@/components/ui";

/** License active in data/license.json but Premium tarball not installed yet. */
export function PremiumSyncModulesCard({
  feature,
  title = "Premium modules not loaded",
}: {
  feature: string;
  title?: string;
}) {
  return (
    <Card className="border-amber-500/30 bg-amber-950/20">
      <h2 className="text-lg font-medium text-white">{title}</h2>
      <div className="mt-4">
        <Alert>
          Your license is active, but the Premium bundle for{" "}
          <code className="text-white">{feature}</code> is not installed on this
          server yet. Click <strong>Refresh modules</strong> on the License page
          (after the Premium artifact exists on the license server).
        </Alert>
      </div>
      <p className="mt-4 text-sm text-panel-muted">
        <Link href="/admin/license" className="text-panel-accent hover:underline">
          Server admin → License → Refresh modules
        </Link>
        . On the VPS: build/upload Premium, then{" "}
        <code className="text-white">node scripts/sync-premium-artifact.mjs</code>{" "}
        and restart pm2.
      </p>
    </Card>
  );
}
