import { requireAdmin } from "@/lib/admin-api";
import { handleApiError, jsonOk } from "@/lib/api";
import { DEFAULT_HEALTH_CHECKS, runHealthChecks } from "@/lib/health";

/** GET /api/admin/health - run every default check and return the report. */
export async function GET() {
  try {
    await requireAdmin();
    const report = await runHealthChecks(DEFAULT_HEALTH_CHECKS);
    return jsonOk({ report });
  } catch (err) {
    return handleApiError(err);
  }
}
