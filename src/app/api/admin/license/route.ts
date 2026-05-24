import { auditLog } from "@/lib/audit";
import { requireAdmin } from "@/lib/admin-api";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import {
  activateLicense,
  deactivateLicense,
  getLicensePublicInfo,
  heartbeatLicense,
} from "@/lib/qadbak-license";
import {
  isPremiumModulesSynced,
  syncPremiumArtifact,
} from "@/lib/premium/server";
import { getProvisioner } from "@/lib/provisioner";

export async function GET() {
  try {
    const session = await requireAdmin();
    const domains = await getProvisioner().listDomains(session);
    const license = await getLicensePublicInfo(domains.length);
    const modulesSynced = await isPremiumModulesSynced();
    return jsonOk({
      license,
      premiumActive: license.features.length > 0,
      modulesSynced,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const body = (await request.json()) as {
      action?: string;
      key?: string;
    };
    const action = body.action ?? "activate";

    if (action === "activate") {
      if (!body.key?.trim()) {
        return jsonError("License key is required.");
      }
      await activateLicense(body.key);
      let modulesSyncError: string | undefined;
      try {
        await syncPremiumArtifact();
      } catch (e) {
        modulesSyncError =
          e instanceof Error ? e.message : "Premium module sync failed";
      }
      await auditLog(session.username, "license-activate");
      const license = await getLicensePublicInfo();
      return jsonOk({
        ok: true,
        license,
        modulesSynced: await isPremiumModulesSynced(),
        modulesSyncError,
      });
    }

    if (action === "deactivate") {
      await deactivateLicense();
      await auditLog(session.username, "license-deactivate");
      return jsonOk({ ok: true, license: await getLicensePublicInfo() });
    }

    if (action === "heartbeat") {
      await heartbeatLicense();
      await auditLog(session.username, "license-heartbeat");
      return jsonOk({ ok: true, license: await getLicensePublicInfo() });
    }

    if (action === "sync") {
      await syncPremiumArtifact();
      await auditLog(session.username, "license-sync");
      const license = await getLicensePublicInfo();
      return jsonOk({
        ok: true,
        license,
        modulesSynced: await isPremiumModulesSynced(),
      });
    }

    return jsonError('Invalid action. Use "activate", "deactivate", "heartbeat", or "sync".');
  } catch (err) {
    return handleApiError(err);
  }
}
