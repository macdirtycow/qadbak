import { requireAdmin } from "@/lib/admin-api";
import { handleApiError, jsonOk } from "@/lib/api";
import { runGlobalTool } from "@/lib/panel-tools";

export async function POST() {
  try {
    await requireAdmin();
    const raw = await runGlobalTool("nodes-ping-health");
    return jsonOk(raw);
  } catch (err) {
    return handleApiError(err);
  }
}
