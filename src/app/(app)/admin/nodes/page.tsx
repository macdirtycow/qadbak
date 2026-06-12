import { AdminNodesView } from "@/components/AdminNodesView";
import { requireAdminPage } from "@/lib/admin-api";

export default async function AdminNodesPage() {
  await requireAdminPage();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Nodes</h1>
        <p className="mt-1 text-sm text-panel-muted">
          Multi-server control plane. Health checks use each node&apos;s agent.
        </p>
      </div>
      <AdminNodesView />
    </div>
  );
}
