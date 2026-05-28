import { AdminAppsCatalog } from "@/components/admin/AdminAppsCatalog";
import { requireAdminPage } from "@/lib/admin-api";
import { listCatalog, listTemplates } from "@/lib/apps";

export const dynamic = "force-dynamic";

export default async function AdminAppsPage() {
  await requireAdminPage();
  const [templates, catalog] = await Promise.all([
    listTemplates(),
    listCatalog(),
  ]);
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-white">App catalog</h1>
        <p className="mt-1 max-w-3xl text-sm text-panel-muted">
          One-click installs orchestrate database creation, file deployment, and
          configuration in a single journaled operation. Use{" "}
          <strong className="text-white">One-click</strong> apps here, or install
          into a custom folder from any domain&apos;s Apps tab.
        </p>
      </header>
      <AdminAppsCatalog templates={templates} catalog={catalog} />
    </div>
  );
}
