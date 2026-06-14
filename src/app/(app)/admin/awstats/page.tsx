import { AdminAwstatsView } from "@/components/AdminAwstatsView";
import { requireAdminPage } from "@/lib/admin-api";

export default async function AdminAwstatsPage() {
  await requireAdminPage();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">AWStats</h1>
        <p className="mt-1 text-panel-muted">Server-wide traffic stats per domain.</p>
      </div>
      <AdminAwstatsView />
    </div>
  );
}
