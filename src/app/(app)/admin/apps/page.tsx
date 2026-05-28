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
  const installCount = catalog.filter((a) => !a.comingSoon).length;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold text-white">App store</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-panel-muted">
          Browse {installCount} apps with real installers on your server — WordPress,
          shops, wikis, forums, Moodle, analytics, and more. Each{" "}
          <strong className="text-white">Install</strong> card runs database setup (when
          needed), deploys files, and records the change in the journal. Per-domain
          paths and rollback live under Domains → Apps.
        </p>
      </header>
      <AdminAppsCatalog templates={templates} catalog={catalog} />
    </div>
  );
}
