import { requireAdmin } from "@/lib/admin-api";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import {
  AppNotFoundError,
  AppValidationError,
  runAppInstall,
} from "@/lib/apps";

/** POST /api/admin/apps/install { templateId, input } - orchestrated install. */
export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const body = (await request.json()) as {
      templateId?: string;
      input?: Record<string, unknown>;
    };
    if (!body.templateId) return jsonError("templateId is required.", 400);
    if (!body.input || typeof body.input !== "object") {
      return jsonError("input object is required.", 400);
    }
    const result = await runAppInstall({
      templateId: body.templateId,
      rawInput: body.input,
      session,
    });
    return jsonOk({ result });
  } catch (err) {
    if (err instanceof AppNotFoundError) return jsonError(err.message, 404);
    if (err instanceof AppValidationError) return jsonError(err.message, 400);
    return handleApiError(err);
  }
}
