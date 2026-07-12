import { requireAdmin } from "@/lib/admin-api";
import { auditLog } from "@/lib/audit";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { runGlobalTool, runGlobalToolForSession } from "@/lib/panel-tools";

export async function GET() {
  try {
    const session = await requireAdmin();
    const raw = await runGlobalToolForSession(session, "panel-policy-get");
    const policy =
      (raw as { policy?: { requireClientTotp?: boolean } }).policy ??
      (raw as { requireClientTotp?: boolean });
    return jsonOk({
      requireClientTotp: Boolean(policy.requireClientTotp),
      policy: { requireClientTotp: Boolean(policy.requireClientTotp) },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const body = (await request.json()) as { requireClientTotp?: boolean };
    const raw = await runGlobalTool("panel-policy-set", body);
    await auditLog(session.username, "panel-policy-update");
    return jsonOk(raw);
  } catch (err) {
    return handleApiError(err);
  }
}
