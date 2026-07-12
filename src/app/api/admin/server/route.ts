import { auditLog } from "@/lib/audit";
import { requireAdmin } from "@/lib/admin-api";
import {
  controlAdminServerService,
  listAdminBandwidth,
  listAdminServerServices,
} from "@/lib/admin-server-services";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { demoSandboxActive, demoServerServicesMock } from "@/lib/demo-sandbox";

export async function GET() {
  try {
    const session = await requireAdmin();
    if (demoSandboxActive(session.username)) {
      return jsonOk(demoServerServicesMock());
    }
    const [bw, { services, source }] = await Promise.all([
      listAdminBandwidth(session),
      listAdminServerServices(session),
    ]);
    return jsonOk({
      bandwidth: bw.rows,
      bandwidthSource: bw.source,
      services,
      servicesSource: source,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const body = (await request.json()) as {
      service?: string;
      action?: "start" | "stop" | "restart";
    };
    if (!body.service) return jsonError("Service is required.");
    const action = body.action ?? "restart";
    const { source } = await controlAdminServerService(body.service, action, session);
    await auditLog(session.username, `${action}-server`, undefined, `${body.service} (${source})`);
    return jsonOk({ ok: true, source });
  } catch (err) {
    return handleApiError(err);
  }
}
