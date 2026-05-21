import { auditLog } from "@/lib/audit";
import { handleApiError, jsonOk } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { createVirtualMinLoginLink } from "@/lib/virtualmin";

type Params = { params: Promise<{ domain: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const session = await requireSession();
    const { domain: encoded } = await params;
    const domain = decodeURIComponent(encoded);
    const urlParams = new URL(request.url).searchParams;
    const dest = urlParams.get("dest");
    const path = urlParams.get("path");
    let redirectUrl: string | undefined;
    if (path) {
      redirectUrl = path.startsWith("/") ? path : `/${path}`;
    } else if (dest === "fileman") {
      redirectUrl = "/filemin/index.cgi";
    } else if (dest === "terminal") {
      redirectUrl = "/xterm/";
    } else if (dest === "shell") {
      redirectUrl = "/shell/";
    }
    const url = await createVirtualMinLoginLink(domain, session, { redirectUrl });
    await auditLog(session.username, "create-login-link", domain);
    return jsonOk({ url });
  } catch (err) {
    return handleApiError(err);
  }
}
