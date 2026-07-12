import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import {
  adminTerminalStepUpRequired,
  verifyAdminTerminalStepUp,
} from "@/lib/admin-terminal-stepup";
import {
  DEMO_TERMINAL_BLOCKED_MESSAGE,
  demoTerminalBlockedForUser,
} from "@/lib/demo-mode";
import { requireAdmin } from "@/lib/admin-api";
import {
  TERMINAL_SETUP_HINT,
  TERMINAL_WS_PROTOCOL,
  createAdminTerminalWsToken,
  terminalAvailable,
  terminalBackendReady,
  terminalWsUrl,
} from "@/lib/terminal-ws";

async function terminalAvailability() {
  if (!terminalAvailable()) {
    return {
      available: false as const,
      error:
        "Native terminal is disabled. Set QADBAK_TERMINAL_WS_PORT and run configure-admin-terminal-sudo.sh on the server.",
    };
  }
  const backendReady = await terminalBackendReady();
  if (!backendReady) {
    return {
      available: false as const,
      error: `Terminal service is not running. ${TERMINAL_SETUP_HINT}`,
    };
  }
  return { available: true as const, backendReady: true };
}

export async function GET() {
  try {
    const session = await requireAdmin();
    if (demoTerminalBlockedForUser(session.username)) {
      return jsonOk({
        available: false,
        error: DEMO_TERMINAL_BLOCKED_MESSAGE,
        demoBlocked: true,
      });
    }
    const status = await terminalAvailability();
    if (!status.available) {
      return jsonOk(status);
    }
    const requiresTotp = await adminTerminalStepUpRequired(session.userId);
    return jsonOk({
      available: true,
      backendReady: true,
      requiresTotp,
      shellUser: "root",
      username: session.username,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    if (demoTerminalBlockedForUser(session.username)) {
      return jsonOk({
        available: false,
        error: DEMO_TERMINAL_BLOCKED_MESSAGE,
        demoBlocked: true,
      });
    }
    const status = await terminalAvailability();
    if (!status.available) {
      return jsonOk(status);
    }
    const body = (await request.json().catch(() => ({}))) as { totp?: string };
    const stepUp = await verifyAdminTerminalStepUp(session.userId, body.totp);
    if (!stepUp.ok) {
      return jsonError(stepUp.error, 403);
    }

    const token = await createAdminTerminalWsToken(session);

    return jsonOk({
      available: true,
      backendReady: true,
      token,
      wsUrl: terminalWsUrl(request),
      wsProtocols: [TERMINAL_WS_PROTOCOL, token],
      shellUser: "root",
      username: session.username,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
