import { AdminDashboardPanel } from "@/components/AdminDashboardPanel";
import { ServerConfigButton } from "@/components/ServerConfigButton";
import { Badge, Card } from "@/components/ui";
import { PremiumUpgradeCard } from "@/lib/premium/stubs";
import { isPremiumFeatureEnabled } from "@/lib/premium/server";
import { getSession } from "@/lib/session";
import { isDomainDisabled } from "@/lib/domain-utils";
import { getProvisioner } from "@/lib/provisioner";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null;

  const panelControlPremium = await isPremiumFeatureEnabled(
    "dashboard-panel-control",
  );

  let domains: Awaited<ReturnType<ReturnType<typeof getProvisioner>["listDomains"]>> = [];
  let error = "";
  try {
    domains = await getProvisioner().listDomains(session);
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not load domains.";
  }

  const active = domains.filter((d) => !isDomainDisabled(d)).length;
  const disabled = domains.length - active;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
        <p className="mt-1 text-panel-muted">
          Overview of your virtual servers
        </p>
      </div>

      {error && (
        <Card>
          <p className="text-red-300">{error}</p>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-panel-muted">Total domains</p>
          <p className="mt-2 text-3xl font-semibold text-white">{domains.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-panel-muted">Active</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-400">{active}</p>
        </Card>
        <Card>
          <p className="text-sm text-panel-muted">Disabled</p>
          <p className="mt-2 text-3xl font-semibold text-amber-400">{disabled}</p>
        </Card>
      </div>

      <Card>
        <h2 className="text-lg font-medium text-white">Recent domains</h2>
        {domains.length === 0 ? (
          <p className="mt-4 text-sm text-panel-muted">No domains found.</p>
        ) : (
          <ul className="mt-4 divide-y divide-panel-border">
            {domains.slice(0, 5).map((d) => (
              <li key={d.name} className="flex items-center justify-between py-3">
                <Link
                  href={`/domains/${encodeURIComponent(d.name)}`}
                  className="font-medium text-white hover:text-panel-link"
                >
                  {d.name}
                </Link>
                <Badge tone={isDomainDisabled(d) ? "warning" : "success"}>
                  {isDomainDisabled(d) ? "Disabled" : "Active"}
                </Badge>
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/domains"
          className="mt-4 inline-block text-sm text-panel-link hover:underline"
        >
          All domains →
        </Link>
      </Card>

      {session.role === "admin" && (
        <>
          {panelControlPremium ? (
            <AdminDashboardPanel />
          ) : (
            <PremiumUpgradeCard
              feature="dashboard-panel-control"
              title="Panel server control (Premium)"
            />
          )}
          <Card>
            <h2 className="text-lg font-medium text-white">Server terminal</h2>
            <p className="mt-2 text-sm text-panel-muted">
              Root shell on this VPS without SSH.
            </p>
            <Link
              href="/admin/terminal"
              className="mt-4 inline-block text-sm text-panel-link hover:underline"
            >
              Open server terminal →
            </Link>
          </Card>
        </>
      )}

      {session.role === "admin" && <ServerConfigButton />}
    </div>
  );
}
