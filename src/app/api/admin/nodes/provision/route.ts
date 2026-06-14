import { auditLog } from "@/lib/audit";
import { requireAdmin } from "@/lib/admin-api";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { agentProvisionDomain } from "@/lib/node-agent-client";
import { loadNodes } from "@/lib/servers";
import { runGlobalTool } from "@/lib/panel-tools";

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const body = (await request.json()) as {
      nodeId?: string;
      domain?: string;
      user?: string;
      plan?: string;
    };
    const nodeId = String(body.nodeId ?? "").trim();
    const domain = String(body.domain ?? "").trim();
    if (!nodeId || !domain) {
      return jsonError("nodeId and domain are required.");
    }
    const nodes = await loadNodes();
    const node = nodes.find((n) => n.id === nodeId);
    if (!node?.agentUrl) {
      return jsonError(`Node "${nodeId}" not found or has no agent URL.`);
    }
    const result = await agentProvisionDomain(node, {
      domain,
      user: body.user,
      plan: body.plan,
    });
    await runGlobalTool("nodes-ping-health").catch(() => {});
    await auditLog(session.username, "node-remote-provision", domain, nodeId);
    return jsonOk({ ok: true, domain, nodeId, result });
  } catch (err) {
    return handleApiError(err);
  }
}
