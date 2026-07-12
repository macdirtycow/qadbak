import { requireAdmin } from "@/lib/admin-api";
import { auditLog } from "@/lib/audit";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { runGlobalTool, runGlobalToolForSession } from "@/lib/panel-tools";

export async function GET() {
  try {
    const session = await requireAdmin();
    const raw = await runGlobalToolForSession(session, "nodes-health");
    return jsonOk(raw);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const body = (await request.json()) as { host?: string; label?: string };
    if (!body.host?.trim()) return jsonError("host is required.");
    const raw = await runGlobalTool("nodes-register", body);
    await auditLog(session.username, "cluster-node-register", undefined, body.host);
    return jsonOk(raw);
  } catch (err) {
    return handleApiError(err);
  }
}
