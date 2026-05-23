import { auditLog } from "@/lib/audit";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { requireDomainApi } from "@/lib/domain-api";
import { getProvisioner } from "@/lib/provisioner";
import { isIndependentMode } from "@/lib/provisioner/native-stub";
import { runProvisioningHelper } from "@/lib/provisioner/native-exec";

type Params = { params: Promise<{ domain: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { session, domain } = await requireDomainApi((await params).domain);
    if (session.role !== "admin") {
      return jsonError("Administrators only.", 403);
    }
    const validation = await getProvisioner().validateDomain(domain, session);
    return jsonOk({ validation });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { session, domain } = await requireDomainApi((await params).domain);
    if (session.role !== "admin") {
      return jsonError("Administrators only.", 403);
    }
    const body = (await request.json()) as {
      action?: string;
      newDomain?: string;
      destHost?: string;
      newOwner?: string;
      confirm?: string;
    };
    if (body.confirm !== domain) {
      return jsonError("Confirmation does not match domain name.");
    }

    switch (body.action) {
      case "delete":
        await getProvisioner().deleteDomain(domain, session);
        await auditLog(session.username, "delete-domain", domain);
        return jsonOk({ ok: true, redirect: "/domains" });
      case "clone":
        if (!body.newDomain) return jsonError("newDomain is required.");
        await getProvisioner().cloneDomain(domain, body.newDomain, session);
        await auditLog(session.username, "clone-domain", domain, body.newDomain);
        return jsonOk({ ok: true, domain: body.newDomain });
      case "migrate": {
        if (!body.destHost) return jsonError("destHost is required.");
        if (isIndependentMode()) {
          const r = await runProvisioningHelper(
            "domain-migrate",
            domain,
            body.destHost,
          );
          await auditLog(session.username, "migrate-domain", domain, body.destHost);
          return jsonOk({
            ok: true,
            backup: r.backup as string | undefined,
            messages: (r.messages as string[]) ?? [],
          });
        }
        await getProvisioner().migrateDomain(domain, body.destHost, session);
        await auditLog(session.username, "migrate-domain", domain, body.destHost);
        return jsonOk({ ok: true });
      }
      case "transfer":
        if (!body.newOwner) return jsonError("newOwner is required.");
        await getProvisioner().transferDomain(domain, body.newOwner, session);
        await auditLog(session.username, "transfer-domain", domain);
        return jsonOk({ ok: true });
      default:
        return jsonError("Unknown action.");
    }
  } catch (err) {
    return handleApiError(err);
  }
}
