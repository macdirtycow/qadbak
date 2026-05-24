import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { PremiumRequiredError } from "./types";
import { isPremiumFeatureEnabled, loadPremiumHandler } from "./loader";

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

export async function dispatchPremiumRoute(
  handlerId: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  request: Request,
  context?: { params?: Record<string, string> },
): Promise<Response> {
  try {
    const handlers = await loadPremiumHandler(handlerId);
    if (!handlers?.[method]) {
      return NextResponse.json(
        {
          error: "Premium license required. Activate at Server admin → License.",
          code: "PREMIUM_REQUIRED",
        },
        { status: 503 },
      );
    }
    return await handlers[method]!(request, context);
  } catch (err) {
    return premiumApiError(err);
  }
}
