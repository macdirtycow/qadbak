import { requireAdmin } from "@/lib/admin-api";
import { handleApiError, jsonOk } from "@/lib/api";
import { listCatalog, listTemplates } from "@/lib/apps";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    const [catalog, templates] = await Promise.all([
      listCatalog(),
      listTemplates(),
    ]);
    const intentIds = new Set(templates.map((t) => t.id));
    return jsonOk({
      catalog,
      templates,
      intentIds: [...intentIds],
    });
  } catch (err) {
    return handleApiError(err);
  }
}
