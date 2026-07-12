import { AdminUpdatesView } from "@/components/AdminUpdatesView";
import { requireAdminPage } from "@/lib/admin-api";
import { PremiumUpgradeCard } from "@/lib/premium/stubs";
import { isPremiumFeatureEnabled } from "@/lib/premium/server";

export default async function AdminUpdatesPage() {
  await requireAdminPage();
  const premium = await isPremiumFeatureEnabled("admin-updates");

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-white">Updates</h2>
        <p className="mt-1 text-sm text-panel-muted">
          Linux package upgrades and Qadbak git updates - without SSH.
        </p>
      </div>
      {premium ? (
        <AdminUpdatesView />
      ) : (
        <PremiumUpgradeCard
          feature="admin-updates"
          title="Admin updates (Premium)"
        />
      )}
    </div>
  );
}
