import { auditLog } from "@/lib/audit";
import { requireAdmin } from "@/lib/admin-api";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import {
  activateLicense,
  deactivateLicense,
  getLicensePublicInfo,
  heartbeatLicense,
  isPremiumActive,
  readStoredLicense,
} from "@/lib/qadbak-license";
import { getProvisioner } from "@/lib/provisioner";
import { beginJournal } from "@/lib/journal";

export async function GET() {
  try {
    const session = await requireAdmin();
    const domains = await getProvisioner().listDomains(session);
    const license = await getLicensePublicInfo(domains.length);
    return jsonOk({
      license,
      premiumActive: await isPremiumActive(),
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
      const previousStored = await readStoredLicense();
      const j = beginJournal({
        action: "license.activate",
        summary: previousStored
          ? "Re-activated Qadbak Premium license"
          : "Activated Qadbak Premium license",
        session,
        metadata: { keyHint: keyHintOf(body.key) },
      });
      // Time-bounded: an admin can undo a misclick quickly without
      // permanently revoking the active license. After 30 min we
      // assume the new key is in real use and refuse to clobber it.
      j.setUndoSpec({
        kind: "license.activate",
        payload: { keyHint: keyHintOf(body.key) },
        warning:
          "Undo will deactivate the license you just entered. You'll need to re-paste a key to get Premium back.",
        ttlMinutes: 30,
      });
      try {
        j.step({
          kind: "external-http",
          summary: "POST /v1/activate on license server",
        });
        await activateLicense(body.key);
        j.step({
          kind: "file-write",
          summary: "Wrote data/license.json",
          filePath: "data/license.json",
        });
        await j.finish(true);
      } catch (e) {
        await j.finish(false, e instanceof Error ? e.message : String(e));
        throw e;
      }
      await auditLog(session.username, "license-activate");
      const license = await getLicensePublicInfo();
      return jsonOk({
        ok: true,
        license,
        journalId: j.id,
      });
    }

    if (action === "deactivate") {
      const stored = await readStoredLicense();
      const j = beginJournal({
        action: "license.deactivate",
        summary: "Deactivated Qadbak Premium license",
        session,
        metadata: { keyHint: stored?.keyHint ?? "—" },
      });
      try {
        await deactivateLicense();
        j.step({
          kind: "file-delete",
          summary: "Cleared data/license.json",
          filePath: "data/license.json",
        });
        await j.finish(true);
      } catch (e) {
        await j.finish(false, e instanceof Error ? e.message : String(e));
        throw e;
      }
      await auditLog(session.username, "license-deactivate");
      return jsonOk({
        ok: true,
        license: await getLicensePublicInfo(),
        journalId: j.id,
      });
    }

    if (action === "heartbeat") {
      await heartbeatLicense();
      await auditLog(session.username, "license-heartbeat");
      return jsonOk({ ok: true, license: await getLicensePublicInfo() });
    }

    return jsonError(
      'Invalid action. Use "activate", "deactivate", or "heartbeat".',
    );
  } catch (err) {
    return handleApiError(err);
  }
}

function keyHintOf(key: string): string {
  const t = key.trim();
  if (t.length <= 8) return t;
  return `${t.slice(0, 4)}…${t.slice(-4)}`;
}
