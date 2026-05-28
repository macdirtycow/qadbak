import { auditLog } from "@/lib/audit";
import { requireAdmin } from "@/lib/admin-api";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { runProvisioningHelper } from "@/lib/provisioner/native-exec";

export async function GET() {
  try {
    await requireAdmin();
    const r = await runProvisioningHelper("firewall-status");
    return jsonOk(r);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const body = (await request.json()) as {
      action?: string;
      port?: string;
      protocol?: string;
    };
    if (body.action === "allow") {
      if (!body.port?.trim()) return jsonError("port is required");
      await runProvisioningHelper(
        "firewall-allow",
        body.port.trim(),
        body.protocol ?? "tcp",
      );
      await auditLog(session.username, "firewall-allow", undefined, body.port);
      return jsonOk({ ok: true });
    }
    if (body.action === "deny") {
      if (!body.port?.trim()) return jsonError("port is required");
      await runProvisioningHelper("firewall-deny", body.port.trim());
      await auditLog(session.username, "firewall-deny", undefined, body.port);
      return jsonOk({ ok: true });
    }
    return jsonError("Unknown action.");
  } catch (err) {
    return handleApiError(err);
  }
}
