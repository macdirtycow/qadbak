import { AdminServerView } from "@/components/AdminServerView";
import { requireAdminPage } from "@/lib/admin-api";
import {
  listAdminBandwidth,
  listAdminServerServices,
} from "@/lib/admin-server-services";

export default async function AdminServerPage() {
  const session = await requireAdminPage();
  let bandwidth: Awaited<ReturnType<typeof listAdminBandwidth>>["rows"] = [];
  let services: Awaited<ReturnType<typeof listAdminServerServices>>["services"] = [];
  let servicesSource: "native" | "virtualmin" = "native";
  let bandwidthSource: "native" | "virtualmin" = "native";
  let error = "";
  try {
    const [bw, svc] = await Promise.all([
      listAdminBandwidth(session),
      listAdminServerServices(session),
    ]);
    bandwidth = bw.rows;
    bandwidthSource = bw.source;
    services = svc.services;
    servicesSource = svc.source;
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not load server data.";
  }
  return (
    <div className="space-y-6">
      <p className="text-sm text-panel-muted">
        Stack services and disk usage per domain — native systemctl via{" "}
        <code className="text-xs">configure-host-services-sudo.sh</code>.
      </p>
      <AdminServerView
        initialBandwidth={bandwidth}
        initialServices={services}
        servicesSource={servicesSource}
        bandwidthSource={bandwidthSource}
        initialError={error}
      />
    </div>
  );
}
