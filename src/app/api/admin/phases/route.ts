import { requireAdmin } from "@/lib/admin-api";
import { handleApiError, jsonOk } from "@/lib/api";
import { MARKET_PHASES } from "@/lib/phases/catalog";
import { phasesSummary } from "@/lib/phases/status";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    const summary = await phasesSummary();
    return jsonOk({
      definitions: MARKET_PHASES,
      ...summary,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
