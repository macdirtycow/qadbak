import { auditLog } from "@/lib/audit";
import { requireAdmin } from "@/lib/admin-api";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import {
  listPanelPm2Processes,
  probePanelPm2Sudo,
  runPanelPm2Action,
} from "@/lib/panel-pm2";

const ACTIONS = [
  "restart",
  "stop",
  "start",
  "restart-terminal",
  "restart-all",
] as const;

export async function GET() {
  try {
    await requireAdmin();
    if (!(await probePanelPm2Sudo())) {
      return jsonOk({
        available: false,
        error:
          "Panel control not configured. Run: sudo bash /opt/qadbak/scripts/configure-panel-pm2-sudo.sh",
      });
    }
    const processes = await listPanelPm2Processes();
    return jsonOk({ available: true, processes });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    if (!(await probePanelPm2Sudo())) {
      return jsonError(
        "Panel control not configured. Run: sudo bash scripts/configure-panel-pm2-sudo.sh",
        503,
      );
    }
    const body = (await request.json()) as { action?: string };
    const action = body.action;
    if (!action || !ACTIONS.includes(action as (typeof ACTIONS)[number])) {
      return jsonError(`Invalid action. Use: ${ACTIONS.join(", ")}.`);
    }
    const output = await runPanelPm2Action(
      action as (typeof ACTIONS)[number],
    );
    await auditLog(session.username, `panel-${action}`);
    const processes = await listPanelPm2Processes().catch(() => []);
    return jsonOk({ ok: true, action, output, processes });
  } catch (err) {
    return handleApiError(err);
  }
}
