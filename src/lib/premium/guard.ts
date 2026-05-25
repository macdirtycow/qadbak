import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { PremiumRequiredError } from "./types";
import { isPremiumFeatureEnabled } from "./server";

export { PremiumRequiredError } from "./types";

export async function requirePremiumFeature(featureId: string): Promise<void> {
  if (!(await isPremiumFeatureEnabled(featureId))) {
    throw new PremiumRequiredError(featureId);
  }
}

export function premiumApiError(err: unknown): Response {
  if (err instanceof PremiumRequiredError) {
    return NextResponse.json(
      {
        error: err.message,
        code: "PREMIUM_REQUIRED",
        feature: err.feature,
      },
      { status: 503 },
    );
  }
  return handleApiError(err);
}

/**
 * Transitional shim for the four /api/admin/* routes that used to
 * `import { dispatchPremiumRoute }` to dynamically load handlers out of
 * the encrypted Premium artifact. The artifact pipeline is gone (open-
 * core model), so these routes just gate on the feature and 503 until
 * the matching Premium implementation lands as plain TypeScript under
 * `src/lib/premium/*`. The handler-id parameter is kept so the route
 * files stay one-liners.
 */
export async function dispatchPremiumRoute(
  handlerId: string,
  _method: "GET" | "POST" | "PATCH" | "DELETE",
  _request: Request,
  _context?: { params?: Record<string, string> },
): Promise<Response> {
  const feature = HANDLER_TO_FEATURE[handlerId] ?? handlerId;
  try {
    await requirePremiumFeature(feature);
    throw new PremiumRequiredError(
      feature,
      `Premium handler "${handlerId}" not yet ported into the public open-core repo.`,
    );
  } catch (err) {
    return premiumApiError(err);
  }
}

const HANDLER_TO_FEATURE: Record<string, string> = {
  "admin.panel-control": "dashboard-panel-control",
  "admin.updates.linux": "admin-updates",
  "admin.updates.qadbak": "admin-updates",
  "admin.domains.panel-client": "panel-client-vhost",
};
