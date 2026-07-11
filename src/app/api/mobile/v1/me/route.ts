import { handleApiError, jsonOk } from "@/lib/api";
import { liveFilesActive } from "@/lib/domain-files-service";
import { apnsConfigured } from "@/lib/mobile-apns";
import { MOBILE_ACCESS_TTL_SEC } from "@/lib/mobile-auth-constants";
import { isPremiumFeatureEnabled } from "@/lib/premium/server";
import { getLicensePublicInfo, isPremiumActive } from "@/lib/qadbak-license";
import { requireSession } from "@/lib/session";

/** Session bootstrap for the iOS app after login or token refresh. */
export async function GET() {
  try {
    const session = await requireSession();
    const domainCount = session.domains?.length ?? 0;
    const [clientRbac, premiumWebmail, filesActive, premiumActive, license] =
      await Promise.all([
        isPremiumFeatureEnabled("client-rbac"),
        isPremiumFeatureEnabled("webmail-ui"),
        liveFilesActive(),
        isPremiumActive(),
        getLicensePublicInfo(domainCount),
      ]);
    const push = apnsConfigured();
    return jsonOk({
      username: session.username,
      role: session.role,
      domains: session.domains,
      accessTokenTtlSec: MOBILE_ACCESS_TTL_SEC,
      clientRbac,
      premiumWebmail,
      license: {
        premiumActive,
        plan: license.plan,
        label: license.type,
        status: license.status,
        features: license.features,
      },
      capabilities: {
        push,
        widgets: true,
        files: filesActive,
        webmail: premiumWebmail,
        clientOwnDomainsOnly: session.role === "client" && clientRbac,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
