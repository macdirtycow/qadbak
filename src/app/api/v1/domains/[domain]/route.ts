import { auditLog } from "@/lib/audit";
import { apiV1Error, requireApiV1 } from "@/lib/api-v1-auth";
import { jsonOk } from "@/lib/api";
import { getProvisioner } from "@/lib/provisioner";

type Params = { params: Promise<{ domain: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const key = await requireApiV1("domains:read");
    const domain = (await params).domain;
    const domains = await getProvisioner().listDomains({
      role: "admin",
      domains: [],
    });
    const row = domains.find((d) => d.name === domain);
    if (!row) {
      return apiV1Error(Object.assign(new Error("Domain not found"), { status: 404 }));
    }
    return jsonOk({ domain: row });
  } catch (err) {
    return apiV1Error(err);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const key = await requireApiV1("domains:write");
    const domain = (await params).domain;
    await getProvisioner().deleteDomain(domain, { role: "admin", domains: [] });
    await auditLog(`api:${key.id}`, "api-v1-delete-domain", domain);
    return jsonOk({ ok: true });
  } catch (err) {
    return apiV1Error(err);
  }
}
