import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import {
  adminTerminalStepUpRequired,
  verifyAdminTerminalStepUp,
} from "@/lib/admin-terminal-stepup";
import { demoTerminalBlocked } from "@/lib/demo-mode";
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
  if (demoTerminalBlocked()) {
    return {
      available: false as const,
      error:
        "Terminal is disabled on the read-only demo panel. Install Qadbak on your own VPS for shell access.",
      demoBlocked: true,
    };
  }
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
    const status = await terminalAvailability();
    if (!status.available) {
      return jsonOk(status);
    }
    const session = await requireAdmin();
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
    const status = await terminalAvailability();
    if (!status.available) {
      return jsonOk(status);
    }

    const session = await requireAdmin();
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
