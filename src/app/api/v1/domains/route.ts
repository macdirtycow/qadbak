import { randomBytes } from "crypto";
import { auditLog } from "@/lib/audit";
import { apiV1Error, requireApiV1 } from "@/lib/api-v1-auth";
import { jsonOk } from "@/lib/api";
import { getProvisioner } from "@/lib/provisioner";

function apiActor() {
  return { role: "admin" as const, domains: [] as string[] };
}

export async function GET() {
  try {
    const key = await requireApiV1("domains:read");
    const domains = await getProvisioner().listDomains(apiActor());
    return jsonOk({ domains });
  } catch (err) {
    return apiV1Error(err);
  }
}

export async function POST(request: Request) {
  try {
    const key = await requireApiV1("domains:write");
    const body = (await request.json()) as {
      domain?: string;
      user?: string;
      plan?: string;
      pass?: string;
    };
    if (!body.domain?.trim()) {
      return apiV1Error(Object.assign(new Error("domain required"), { status: 400 }));
    }
    const pass = body.pass?.trim() || randomBytes(12).toString("base64url");
    await getProvisioner().createDomain(
      {
        domain: body.domain.trim().toLowerCase(),
        pass,
        user: body.user?.trim(),
        plan: body.plan,
      },
      apiActor(),
    );
    await auditLog(`api:${key.id}`, "api-v1-create-domain", body.domain);
    return jsonOk({ ok: true, domain: body.domain.trim().toLowerCase() });
  } catch (err) {
    return apiV1Error(err);
  }
}
