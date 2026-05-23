import { handleApiError, jsonOk } from "@/lib/api";
import { requireDomainApi } from "@/lib/domain-api";
import { runProvisioningHelper } from "@/lib/provisioner/native-exec";

type Params = { params: Promise<{ domain: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    await requireDomainApi((await params).domain);
    const raw = await runProvisioningHelper("mail-dns-hints", (await params).domain);
    return jsonOk({ hints: raw.hints ?? null });
  } catch (err) {
    return handleApiError(err);
  }
}
