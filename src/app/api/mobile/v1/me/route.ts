import { handleApiError, jsonOk } from "@/lib/api";
import { MOBILE_ACCESS_TTL_SEC } from "@/lib/mobile-auth-constants";
import { clientRbacEnabled } from "@/middleware/client-rbac";
import { isPremiumFeatureEnabled } from "@/lib/premium/server";
import { requireSession } from "@/lib/session";

/** Session bootstrap for the iOS app after login or token refresh. */
export async function GET() {
  try {
    const session = await requireSession();
    const clientRbac = clientRbacEnabled();
    const premiumWebmail = await isPremiumFeatureEnabled("webmail-ui");
    return jsonOk({
      username: session.username,
      role: session.role,
      domains: session.domains,
      accessTokenTtlSec: MOBILE_ACCESS_TTL_SEC,
      clientRbac,
      premiumWebmail,
      capabilities: {
        push: true,
        widgets: true,
        files: true,
        webmail: premiumWebmail,
        clientOwnDomainsOnly: session.role === "client" && clientRbac,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
