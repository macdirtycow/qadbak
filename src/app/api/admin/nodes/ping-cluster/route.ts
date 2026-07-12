import { requireAdmin } from "@/lib/admin-api";
import { handleApiError, jsonOk } from "@/lib/api";
import { runGlobalToolForSession } from "@/lib/panel-tools";

export async function POST() {
  try {
    const session = await requireAdmin();
    const raw = await runGlobalToolForSession(session, "nodes-ping-health");
    return jsonOk(raw);
  } catch (err) {
    return handleApiError(err);
  }
}
