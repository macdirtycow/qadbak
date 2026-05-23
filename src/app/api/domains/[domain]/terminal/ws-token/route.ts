import { handleApiError, jsonOk } from "@/lib/api";
import { requireDomainApi } from "@/lib/domain-api";
import {
  TERMINAL_SETUP_HINT,
  createTerminalWsToken,
  terminalAvailable,
  terminalBackendReady,
  terminalWsUrl,
} from "@/lib/terminal-ws";
import { getProvisioner } from "@/lib/provisioner";

type Params = { params: Promise<{ domain: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    if (!terminalAvailable()) {
      return jsonOk({
        available: false,
        error:
          "Native terminal is disabled. Set QADBAK_TERMINAL_WS_PORT and run configure-domain-terminal-sudo.sh on the server.",
      });
    }

    const backendReady = await terminalBackendReady();
    if (!backendReady) {
      return jsonOk({
        available: false,
        error: `Terminal service is not running. ${TERMINAL_SETUP_HINT}`,
      });
    }

    const { domain, session } = await requireDomainApi((await params).domain);
    const unixUser = await getProvisioner().resolveDomainUnixUser(domain, session);
    const token = await createTerminalWsToken(domain, unixUser, session);
    const wsUrl = terminalWsUrl(request, token);

    return jsonOk({
      available: true,
      backendReady: true,
      token,
      wsUrl,
      unixUser,
      domain,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
