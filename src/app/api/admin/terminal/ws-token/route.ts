import { requireAdmin } from "@/lib/admin-api";
import { handleApiError, jsonOk } from "@/lib/api";
import {
  TERMINAL_SETUP_HINT,
  createAdminTerminalWsToken,
  terminalAvailable,
  terminalBackendReady,
} from "@/lib/terminal-ws";

export async function GET() {
  try {
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
      shellUser: "root",
      username: session.username,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
