import { handleApiError, jsonOk } from "@/lib/api";
import { requireDomainApi } from "@/lib/domain-api";
import { getWebsiteHealth } from "@/lib/website-health";

type Params = { params: Promise<{ domain: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { session, domain } = await requireDomainApi((await params).domain);
    const report = await getWebsiteHealth(domain, session);
    return jsonOk(report);
  } catch (err) {
    return handleApiError(err);
  }
}
