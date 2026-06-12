import { AdminPanelPolicyView } from "@/components/AdminPanelPolicyView";
import { requireAdminPage } from "@/lib/admin-api";

export default async function AdminPolicyPage() {
  await requireAdminPage();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Panel policy</h1>
        <p className="mt-1 text-sm text-panel-muted">
          Global rules for client access and security.
        </p>
      </div>
      <AdminPanelPolicyView />
    </div>
  );
}
