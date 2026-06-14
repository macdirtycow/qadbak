import { AdminCronView } from "@/components/AdminCronView";
import { requireAdminPage } from "@/lib/admin-api";

export default async function AdminCronPage() {
  await requireAdminPage();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">System cron</h1>
        <p className="mt-1 text-panel-muted">Root crontab — native admin, no embed.</p>
      </div>
      <AdminCronView />
    </div>
  );
}
