import { requireAdmin } from "@/lib/admin-api";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { getEntry } from "@/lib/journal";

/** GET /api/admin/journal/:id - single entry detail (admin only). */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    if (!id || !/^[a-z0-9]+$/i.test(id)) {
      return jsonError("Invalid journal id.", 400);
    }
    const entry = await getEntry(id, 30);
    if (!entry) {
      return jsonError("Journal entry not found.", 404);
    }
    return jsonOk({ entry });
  } catch (err) {
    return handleApiError(err);
  }
}
