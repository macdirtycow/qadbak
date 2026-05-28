import { auditLog } from "@/lib/audit";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { requireDomainApi } from "@/lib/domain-api";
import { runProvisioningHelper } from "@/lib/provisioner/native-exec";

type Params = { params: Promise<{ domain: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { domain } = await requireDomainApi((await params).domain);
    const r = await runProvisioningHelper("backup-policy-get", domain);
    return jsonOk({ policy: r.policy ?? {} });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { session, domain } = await requireDomainApi((await params).domain);
    if (session.role !== "admin") {
      return jsonError("Only administrators may change offsite backup policy.", 403);
    }
    const body = (await request.json()) as {
      offsite?: boolean;
      providerId?: string;
    };
    await runProvisioningHelper(
      "backup-policy-set",
      domain,
      JSON.stringify(body),
    );
    await auditLog(session.username, "backup-policy", domain);
    const r = await runProvisioningHelper("backup-policy-get", domain);
    return jsonOk({ policy: r.policy ?? {} });
  } catch (err) {
    return handleApiError(err);
  }
}
