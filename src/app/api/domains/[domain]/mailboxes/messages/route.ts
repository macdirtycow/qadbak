import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { requireDomainApi } from "@/lib/domain-api";
import { nativeFeatureEnabled } from "@/lib/provisioner/native-features";
import { runProvisioningHelper } from "@/lib/provisioner/native-exec";

type Params = { params: Promise<{ domain: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const { domain } = await requireDomainApi((await params).domain);
    const sp = new URL(request.url).searchParams;
    const user = sp.get("user") ?? "";
    const folder = sp.get("folder") ?? "INBOX";

    if (!nativeFeatureEnabled("imap")) {
      return jsonError("IMAP message list requires native Dovecot mode.", 501);
    }

    const raw = await runProvisioningHelper(
      "imap-messages",
      domain,
      user,
      folder,
    );
    return jsonOk({
      messages: (raw.messages as unknown[]) ?? [],
      folder: (raw.folder as string) ?? folder,
      authUser: raw.authUser as string | undefined,
      source: raw.source as string | undefined,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
