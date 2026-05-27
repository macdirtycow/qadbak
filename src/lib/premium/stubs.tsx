import Link from "next/link";
import { Alert, Card } from "@/components/ui";

export function PremiumUpgradeCard({
  feature,
  title = "Premium feature",
}: {
  feature: string;
  title?: string;
}) {
  return (
    <Card className="border-amber-500/30 bg-amber-950/20">
      <h2 className="text-lg font-medium text-white">{title}</h2>
      <div className="mt-4">
        <Alert>
          This feature ({feature}) requires a Qadbak Premium license. Core
          evaluation includes domain, mail, DNS, files, and backups only.
        </Alert>
      </div>
      <p className="mt-4 text-sm text-panel-muted">
        A new key in license admin does not activate this server automatically.
        Open{" "}
        <Link href="/admin/license" className="text-panel-accent hover:underline">
          Server admin → License
        </Link>
        , paste the key, and click <strong className="text-white">Activate</strong>.
        Then <strong className="text-white">Heartbeat now</strong> if Premium modules stay empty.
        Commercial licensing:{" "}
        <a
          href="https://omiiba.dev"
          className="text-panel-accent hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          omiiba.dev
        </a>
        .
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
