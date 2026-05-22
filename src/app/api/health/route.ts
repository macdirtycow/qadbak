import { APP_NAME, APP_SITE } from "@/lib/brand";
import { listEnabledNativeFeatures } from "@/lib/provisioner/native-features";
import { getProvisionerId } from "@/lib/provisioner";
import { NextResponse } from "next/server";

/** Public liveness check for nginx/monitoring (no auth). */
export async function GET() {
  const mock = process.env.VIRTUALMIN_MOCK === "true";
  const fb = process.env.QADBAK_VIRTUALMIN_FALLBACK?.trim().toLowerCase();
  const fallback =
    fb === "false" || fb === "0" || fb === "no" ? false : Boolean(fb ?? true);
  return NextResponse.json({
    ok: true,
    app: APP_NAME,
    host: APP_SITE,
    mock,
    provisioner: getProvisionerId(),
    virtualminFallback: fallback,
    nativeFeatures: listEnabledNativeFeatures(),
    ts: new Date().toISOString(),
  });
}
