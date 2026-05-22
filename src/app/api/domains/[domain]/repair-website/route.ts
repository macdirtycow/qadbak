import { auditLog } from "@/lib/audit";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { requireAdmin } from "@/lib/admin-api";
import { repairAvailable, repairDomainWebsite } from "@/lib/domain-repair";

type Params = { params: Promise<{ domain: string }> };

export async function POST(_req: Request, { params }: Params) {
  try {
    const session = await requireAdmin();
    const domain = decodeURIComponent((await params).domain);
    if (!(await repairAvailable())) {
      return jsonError(
        "Website repair is not configured on this server. Run: sudo bash scripts/configure-domain-repair-sudo.sh",
        503,
      );
    }
    const output = await repairDomainWebsite(domain);
    await auditLog(session.username, "repair-website", domain);
    return jsonOk({ ok: true, output });
  } catch (err) {
    return handleApiError(err);
  }
}
