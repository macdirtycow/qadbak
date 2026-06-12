import { auditLog } from "@/lib/audit";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { requireDomainApi } from "@/lib/domain-api";
import { runDomainTool } from "@/lib/panel-tools";
import { SITE_TOOLS_READ, SITE_TOOLS_WRITE } from "@/lib/site-tools-actions";

type Params = { params: Promise<{ domain: string }> };

const READ = new Set<string>(SITE_TOOLS_READ);
const WRITE = new Set<string>(SITE_TOOLS_WRITE);

export async function POST(request: Request, { params }: Params) {
  try {
    const { session, domain } = await requireDomainApi((await params).domain);
    const body = (await request.json()) as { action?: string; payload?: Record<string, unknown> };
    const action = body.action?.trim();
    if (!action) return jsonError("action is required.");
    if (!READ.has(action) && !WRITE.has(action)) {
      return jsonError(`Unknown action: ${action}`);
    }

    const raw = await runDomainTool(domain, action, body.payload);
    if (WRITE.has(action)) {
      await auditLog(session.username, `panel-tool-${action}`, domain);
    }
    return jsonOk(raw);
  } catch (err) {
    return handleApiError(err);
  }
}
