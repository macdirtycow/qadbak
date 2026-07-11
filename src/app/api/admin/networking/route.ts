import { requireAdmin } from "@/lib/admin-api";
import { handleApiError, jsonOk } from "@/lib/api";
import { runGlobalTool } from "@/lib/panel-tools";

export async function GET() {
  try {
    await requireAdmin();
    const raw = await runGlobalTool("system-network-summary");
    return jsonOk(raw);
  } catch (err) {
    return handleApiError(err);
  }
}
