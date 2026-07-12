import { handleApiError, jsonOk } from "@/lib/api";
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

export async function GET(request: Request) {
  try {
    if (demoTerminalBlocked()) {
      return jsonOk({
        available: false,
        error:
          "Terminal is disabled on the read-only demo panel. Install Qadbak on your own VPS for shell access.",
        demoBlocked: true,
      });
    }
    if (!terminalAvailable()) {
      return jsonOk({
        available: false,
        error:
          "Native terminal is disabled. Set QADBAK_TERMINAL_WS_PORT and run configure-admin-terminal-sudo.sh on the server.",
      });
    }

    const backendReady = await terminalBackendReady();
    if (!backendReady) {
      return jsonOk({
        available: false,
        error: `Terminal service is not running. ${TERMINAL_SETUP_HINT}`,
      });
    }

    const session = await requireAdmin();
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
