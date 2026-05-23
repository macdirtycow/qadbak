import { AdminHostMetrics } from "@/components/AdminHostMetrics";
import { AdminServerView } from "@/components/AdminServerView";
import { requireAdminPage } from "@/lib/admin-api";
import {
  listAdminBandwidth,
  listAdminServerServices,
} from "@/lib/admin-server-services";
import { getHostMetrics } from "@/lib/host-metrics";

export default async function AdminStatusPage() {
  const session = await requireAdminPage();
  let bandwidth: Awaited<ReturnType<typeof listAdminBandwidth>>["rows"] = [];
  let services: Awaited<ReturnType<typeof listAdminServerServices>>["services"] = [];
  let metrics: Awaited<ReturnType<typeof getHostMetrics>> | null = null;
  let metricsError = "";
  let servicesError = "";

  try {
    metrics = await getHostMetrics();
  } catch (e) {
    metricsError = e instanceof Error ? e.message : "Could not load host metrics.";
  }

  try {
    const [bw, svc] = await Promise.all([
      listAdminBandwidth(session),
      listAdminServerServices(session),
    ]);
    bandwidth = bw.rows;
    services = svc.services;
  } catch (e) {
    servicesError = e instanceof Error ? e.message : "Could not load server data.";
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">System status</h1>
        <p className="mt-1 text-sm text-panel-muted">
          CPU, memory, disk, firewall, and service health — native Qadbak.
        </p>
      </div>
      <AdminHostMetrics initialMetrics={metrics} initialError={metricsError} />
      <AdminServerView
        initialBandwidth={bandwidth}
        initialServices={services}
        initialError={servicesError}
      />
    </div>
  );
}
