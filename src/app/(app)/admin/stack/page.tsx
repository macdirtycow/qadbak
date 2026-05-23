import { AdminStackView } from "@/components/AdminStackView";
import { requireAdminPage } from "@/lib/admin-api";

export default async function AdminStackPage() {
  await requireAdminPage();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Stack config</h1>
        <p className="mt-1 text-sm text-panel-muted">
          Validate and reload nginx, Apache, mail, and firewall via audited helpers.
        </p>
      </div>
      <AdminStackView />
    </div>
  );
}
