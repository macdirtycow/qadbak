import { requireAdmin } from "@/lib/admin-api";
import { handleApiError, jsonOk } from "@/lib/api";
import { listEntries } from "@/lib/journal";

/** GET /api/admin/journal?date=&user=&action=&days=&domain=&failuresOnly=&limit= */
export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const params = url.searchParams;
    const result = await listEntries({
      date: params.get("date") ?? undefined,
      days: paramInt(params.get("days")),
      user: params.get("user") ?? undefined,
      action: params.get("action") ?? undefined,
      domain: params.get("domain") ?? undefined,
      limit: paramInt(params.get("limit")),
      failuresOnly:
        params.get("failuresOnly") === "1" ||
        params.get("failuresOnly") === "true",
    });
    return jsonOk(result);
  } catch (err) {
    return handleApiError(err);
  }
}

function paramInt(v: string | null): number | undefined {
  if (v == null) return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
}
