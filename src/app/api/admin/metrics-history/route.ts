import { requireAdmin } from "@/lib/admin-api";
import { handleApiError, jsonOk } from "@/lib/api";
import { demoMetricsHistoryMock, demoSandboxActive } from "@/lib/demo-sandbox";
import { readMetricsHistory } from "@/lib/metrics-history";
import { runProvisioningHelper } from "@/lib/provisioner/native-exec";

export async function GET(request: Request) {
  try {
    const session = await requireAdmin();
    const raw = Number(new URL(request.url).searchParams.get("hours") || "24");
    const hours = Number.isFinite(raw)
      ? Math.min(720, Math.max(1, Math.floor(raw)))
      : 24;
    if (demoSandboxActive(session.username)) {
      return jsonOk(demoMetricsHistoryMock(hours));
    }
    const history = await readMetricsHistory(hours);
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
