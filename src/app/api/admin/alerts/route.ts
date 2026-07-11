import { requireAdmin } from "@/lib/admin-api";
import { evaluateAlerts } from "@/lib/alert-dispatcher";
import {
  loadAlertSettings,
  normalizeAlertSettings,
  saveAlertSettings,
} from "@/lib/alert-rules";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";

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
      if (result.skipped) {
        return jsonError(result.skipped, 503);
      }
      return jsonOk(result);
    }
    if (body.action === "mobile-push") {
      const { evaluateMobilePushAlerts } = await import("@/lib/mobile-push-alerts");
      const result = await evaluateMobilePushAlerts();
      return jsonOk(result);
    }
    return jsonError("Unknown action.", 400);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    const body = normalizeAlertSettings(await request.json());
    await saveAlertSettings(body);
    return jsonOk({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
