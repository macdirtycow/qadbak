import { requireAdmin } from "@/lib/admin-api";
import { handleApiError, jsonOk } from "@/lib/api";
import { readMetricsHistory } from "@/lib/metrics-history";
import { runProvisioningHelper } from "@/lib/provisioner/native-exec";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const hours = Number(new URL(request.url).searchParams.get("hours") || "24");
    const history = await readMetricsHistory(Number.isFinite(hours) ? hours : 24);
    return jsonOk({ history });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST() {
  try {
    await requireAdmin();
    const r = await runProvisioningHelper("metrics-snapshot");
    return jsonOk({ snapshot: r.snapshot });
  } catch (err) {
    return handleApiError(err);
  }
}
