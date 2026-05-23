import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { requireDomainApi } from "@/lib/domain-api";
import { nativeFeatureEnabled } from "@/lib/provisioner/native-features";
import { runProvisioningHelper } from "@/lib/provisioner/native-exec";

type Params = { params: Promise<{ domain: string; id: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const { domain } = await requireDomainApi((await params).domain);
    const { id } = await params;
    const sp = new URL(request.url).searchParams;
    const user = sp.get("user") ?? "";
    const folder = sp.get("folder") ?? "INBOX";
    const messageId = decodeURIComponent(id);

    if (!nativeFeatureEnabled("imap")) {
      return jsonError("Reading IMAP messages requires native Dovecot mode.", 501);
    }

    const raw = await runProvisioningHelper(
      "imap-fetch",
      domain,
      user,
      folder,
      messageId,
    );
    return jsonOk({
      message: raw.message,
      folder: (raw.folder as string) ?? folder,
      authUser: raw.authUser as string | undefined,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
