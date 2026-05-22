import { handleApiError, jsonOk } from "@/lib/api";
import { requireDomainApi } from "@/lib/domain-api";
import {
  createTerminalWsToken,
  terminalAvailable,
  terminalWsUrl,
} from "@/lib/terminal-ws";
import { resolveDomainUnixUser } from "@/lib/virtualmin";

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

    const { domain, session } = await requireDomainApi((await params).domain);
    const unixUser = await resolveDomainUnixUser(domain, session);
    const token = await createTerminalWsToken(domain, unixUser, session);
    const wsUrl = terminalWsUrl(request, token);

    return jsonOk({
      available: true,
      token,
      wsUrl,
      unixUser,
      domain,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
