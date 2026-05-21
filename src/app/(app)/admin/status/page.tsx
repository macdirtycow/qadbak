import { AdminServerView } from "@/components/AdminServerView";
import { WebminEmbed } from "@/components/WebminEmbed";
import { requireAdminPage } from "@/lib/admin-api";
import { listBandwidth, listServerStatuses } from "@/lib/virtualmin";

export default async function AdminStatusPage() {
  const session = await requireAdminPage();
  let bandwidth: Awaited<ReturnType<typeof listBandwidth>> = [];
  let services: Awaited<ReturnType<typeof listServerStatuses>> = [];
  let error = "";
  try {
    [bandwidth, services] = await Promise.all([
      listBandwidth(session),
      listServerStatuses(session),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not load server data.";
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">System status</h1>
        <p className="mt-1 text-sm text-panel-muted">
          Webmin dashboard and VirtualMin service overview
        </p>
      </div>
      <WebminEmbed
        title="Webmin dashboard"
        description="CPU, memory, disk, uptime, and package updates from Webmin."
        fetchUrl="/api/admin/webmin/link?module=dashboard"
        height="min(50vh, 560px)"
      />
      <AdminServerView
        initialBandwidth={bandwidth}
        initialServices={services}
        initialError={error}
      />
    </div>
  );
}
