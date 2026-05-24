import { AdminUpdatesView } from "@/components/AdminUpdatesView";
import { requireAdminPage } from "@/lib/admin-api";
import { PremiumSyncModulesCard } from "@/lib/premium/sync-card";
import { PremiumUpgradeCard } from "@/lib/premium/stubs";
import {
  isPremiumFeatureEnabled,
  isPremiumModulesSynced,
} from "@/lib/premium/server";
import { isPremiumActive } from "@/lib/qadbak-license";

export default async function AdminUpdatesPage() {
  await requireAdminPage();
  const licensed = await isPremiumActive();
  const synced = await isPremiumModulesSynced();
  const premium = await isPremiumFeatureEnabled("admin-updates");

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-white">Updates</h2>
        <p className="mt-1 text-sm text-panel-muted">
          Linux package upgrades and Qadbak git updates — without SSH.
        </p>
      </div>
      {premium ? (
        <AdminUpdatesView />
      ) : licensed && !synced ? (
        <PremiumSyncModulesCard
          feature="admin-updates"
          title="Admin updates — refresh Premium modules"
        />
      ) : (
        <PremiumUpgradeCard feature="admin-updates" title="Admin updates (Premium)" />
      )}
    </div>
  );
}
