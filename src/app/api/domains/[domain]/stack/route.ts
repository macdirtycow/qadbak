import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { requireDomainApi } from "@/lib/domain-api";
import {
  probeStackHelperSudo,
  validateDomainStackConfig,
} from "@/lib/stack-helper-sudo";

type Params = { params: Promise<{ domain: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { domain, session } = await requireDomainApi((await params).domain);
    if (session.role !== "admin") {
      return jsonError("Admin only.", 403);
    }
    const available = await probeStackHelperSudo();
    if (!available) {
      return jsonOk({
        available: false,
        domain,
        error:
          "Stack helper not configured on server (configure-stack-helper-sudo.sh).",
      });
    }
    const result = await validateDomainStackConfig(domain);
    return jsonOk({ available: true, ...result });
  } catch (err) {
    return handleApiError(err);
  }
}
