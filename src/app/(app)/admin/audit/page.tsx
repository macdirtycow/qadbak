import { AdminAuditLog } from "@/components/AdminAuditLog";
import { requireAdminPage } from "@/lib/admin-api";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage() {
  await requireAdminPage();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-white">Activity log</h1>
        <p className="mt-1 max-w-3xl text-sm text-panel-muted">
          Local audit trail of sign-ins, API use, firewall changes, and domain actions.
          Stored only on this server - filter, review failed logins, or export from{" "}
          <a href="/admin/privacy" className="text-panel-link hover:underline">
            Privacy &amp; data
          </a>
          .
        </p>
      </header>
      <AdminAuditLog />
    </div>
  );
}
