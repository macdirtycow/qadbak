import { requireAdmin } from "@/lib/admin-api";
import { evaluateAlerts } from "@/lib/alert-dispatcher";
import { loadAlertSettings, saveAlertSettings } from "@/lib/alert-rules";
import { handleApiError, jsonOk } from "@/lib/api";

export async function GET() {
  try {
    await requireAdmin();
    const settings = await loadAlertSettings();
    return jsonOk({ settings });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = (await request.json()) as { action?: string };
    if (body.action === "evaluate") {
      const result = await evaluateAlerts();
      return jsonOk(result);
    }
    return jsonOk({ ok: false });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    const body = (await request.json()) as Parameters<typeof saveAlertSettings>[0];
    await saveAlertSettings(body);
    return jsonOk({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
