import { requireAdmin } from "@/lib/admin-api";
import { handleApiError, jsonOk } from "@/lib/api";
import { demoHostMetricsMock, demoSandboxActive } from "@/lib/demo-sandbox";
import { getHostMetrics } from "@/lib/host-metrics";

export async function GET() {
  try {
    const session = await requireAdmin();
    if (demoSandboxActive(session.username)) {
      return jsonOk(demoHostMetricsMock());
    }
    const metrics = await getHostMetrics();
    return jsonOk({ metrics });
  } catch (err) {
    return handleApiError(err);
  }
}
