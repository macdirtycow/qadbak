import { auditLog } from "@/lib/audit";
import { requireAdmin } from "@/lib/admin-api";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import {
  probeStackHelperSudo,
  runStackAction,
  validateStackConfig,
} from "@/lib/stack-helper-sudo";

export async function GET() {
  try {
    await requireAdmin();
    const available = await probeStackHelperSudo();
    if (!available) {
      return jsonOk({
        available: false,
        error:
          "Stack helper not configured. Run: sudo bash /opt/qadbak/scripts/configure-stack-helper-sudo.sh",
      });
    }
    const result = await validateStackConfig();
    return jsonOk({ available: true, ...result });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    if (!(await probeStackHelperSudo())) {
      return jsonError(
        "Stack helper not configured. Run: sudo bash scripts/configure-stack-helper-sudo.sh",
        503,
      );
    }
    const body = (await request.json()) as {
      action?: string;
      port?: number;
    };
    const action = body.action;
    if (
      !action ||
      !["nginx-reload", "apache-reload", "apply-nginx-vhosts", "ufw-allow"].includes(
        action,
      )
    ) {
      return jsonError("Invalid action.");
    }
    if (action === "ufw-allow" && (!body.port || body.port < 1 || body.port > 65535)) {
      return jsonError("Valid port (1-65535) required for ufw-allow.");
    }
    const result = await runStackAction(
      action as "nginx-reload" | "apache-reload" | "apply-nginx-vhosts" | "ufw-allow",
      { port: body.port },
    );
    await auditLog(session.username, `stack-${action}`, undefined, String(body.port ?? ""));
    const validation = await validateStackConfig();
    return jsonOk({ ...result, validation });
  } catch (err) {
    return handleApiError(err);
  }
}
