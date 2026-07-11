import { AdminNetworkingView } from "@/components/AdminNetworkingView";
import { requireAdminPage } from "@/lib/admin-api";

export default async function AdminNetworkingPage() {
  await requireAdminPage();
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Networking</h1>
        <p className="mt-1 text-sm text-panel-muted">
          Server interfaces, default route, and the public IP for customer DNS records.
        </p>
      </div>
      <AdminNetworkingView />
    </div>
  );
}
