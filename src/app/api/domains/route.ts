import { auditLog } from "@/lib/audit";
import { requireAdmin } from "@/lib/admin-api";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { repairAvailable, repairDomainWebsite } from "@/lib/domain-repair";
import { VirtualMinError } from "@/lib/errors";
import { getProvisioner } from "@/lib/provisioner";
import { isIndependentMode } from "@/lib/provisioner/native-stub";

export async function GET() {
  try {
    const session = await requireSession();
    const domains = await getProvisioner().listDomains(session);
    await auditLog(session.username, "list-domains");
    return jsonOk({ domains });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const body = (await request.json()) as {
      domain?: string;
      pass?: string;
      user?: string;
      plan?: string;
      parent?: string;
      type?: "top" | "sub" | "alias";
    };
    if (!body.domain || !body.pass) {
      return jsonError("Domain name and password are required.");
    }
    const domainName = body.domain.trim().toLowerCase();

    try {
      await getProvisioner().createDomain(
        {
          domain: domainName,
          pass: body.pass,
          user: body.user,
          plan: body.plan,
          parent: body.parent,
          type: body.type,
          alias: body.type === "alias",
          subdom: body.type === "sub",
        },
        session,
      );
    } catch (err) {
      if (
        err instanceof VirtualMinError &&
        /already exists|already been created|already in use/i.test(err.message)
      ) {
        const existing = await getProvisioner().findDomainByName(domainName, session);
        if (existing) {
          return jsonOk({
            ok: true,
            domain: existing.name,
            note: "Domain already existed on this server.",
          });
        }
      }
      throw err;
    }

    let created: Awaited<
      ReturnType<ReturnType<typeof getProvisioner>["findDomainByName"]>
    > | undefined;
    for (let attempt = 0; attempt < 10; attempt++) {
      created = await getProvisioner().findDomainByName(domainName, session);
      if (created) break;
      await new Promise((r) => setTimeout(r, 1500));
    }

    if (!created) {
      const listed = await getProvisioner().listDomains(session).catch(() => []);
      const known = listed.some((d) => d.name.toLowerCase() === domainName);
      if (known) {
        return jsonOk({ ok: true, domain: domainName });
      }
      const hint =
        listed.length === 0
          ? isIndependentMode()
            ? "Qadbak cannot read domains (check data/native-domains.json and pm2 env). Run: cd /opt/qadbak && git pull && sudo bash scripts/pm2-restart-qadbak.sh "
            : "Qadbak cannot read domains (pm2 may not load .env.local). Run: cd /opt/qadbak && git pull && sudo bash scripts/pm2-restart-qadbak.sh && npm run test-api. "
          : `This server has ${listed.length} domain(s) but not "${domainName}". `;
      return jsonError(
        hint +
          "If the domain already exists, open Domains in the menu instead of creating it again.",
        502,
      );
    }

    await auditLog(session.username, "create-domain", domainName);

    let hostingNote: string | undefined;
    if (await repairAvailable()) {
      try {
        await repairDomainWebsite(created.name);
        hostingNote =
          "Website hosting configured for this domain (nginx public_html vhost, same as Repair).";
      } catch {
        hostingNote =
          "Domain created. Open Overview → Repair on server if the site does not load yet.";
      }
    }

    return jsonOk({ ok: true, domain: created.name, hostingNote });
  } catch (err) {
    return handleApiError(err);
  }
}
