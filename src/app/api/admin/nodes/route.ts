import { requireAdmin } from "@/lib/admin-api";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { demoNodesMock, demoSandboxActive } from "@/lib/demo-sandbox";
import { probeNodeHealth } from "@/lib/node-agent-client";
import { isIndependentMode } from "@/lib/provisioner/native-stub";
import { getDefaultNode, loadNodes, saveNodes, type QadbakNode } from "@/lib/servers";

export async function GET() {
  try {
    const session = await requireAdmin();
    if (demoSandboxActive(session.username)) {
      return jsonOk(demoNodesMock());
    }
    const nodes = await loadNodes();
    const health = await Promise.all(nodes.map((n) => probeNodeHealth(n)));
    return jsonOk({
      nodes,
      health,
      defaultNodeId: getDefaultNode(nodes).id,
      multiServerEnabled: process.env.QADBAK_MULTI_SERVER === "true",
      provisioner: isIndependentMode() ? "native" : "hybrid",
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = (await request.json()) as Partial<QadbakNode>;
    const id = String(body.id ?? "").trim();
    const name = String(body.name ?? "").trim();
    const agentUrl = String(body.agentUrl ?? "").trim();
    if (!id || !/^[a-z0-9-]+$/.test(id)) {
      return jsonError("id is required (lowercase letters, numbers, hyphens).");
    }
    if (!name) return jsonError("name is required.");
    if (!agentUrl.startsWith("http://") && !agentUrl.startsWith("https://")) {
      return jsonError("agentUrl must be http(s)://…");
    }
    const nodes = await loadNodes();
    if (nodes.some((n) => n.id === id)) {
      return jsonError(`Node "${id}" already exists.`);
    }
    const entry: QadbakNode = {
      id,
      name,
      roles: ["provisioner"],
      agentUrl,
      ...(isIndependentMode()
        ? {}
        : {
            legacyApiUrl:
              String(body.legacyApiUrl ?? (body as { legacyApiUrl?: string }).legacyApiUrl ?? "").trim() ||
              undefined,
          }),
      isDefault: false,
    };
    await saveNodes([...nodes, entry]);
    const health = await probeNodeHealth(entry);
    return jsonOk({ node: entry, health });
  } catch (err) {
    return handleApiError(err);
  }
}
