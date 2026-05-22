import { auditLog } from "@/lib/audit";
import { requireAdmin } from "@/lib/admin-api";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { requireSession } from "@/lib/session";
import {
  createDomain,
  findDomainByName,
  listDomains,
} from "@/lib/virtualmin";
import { VirtualMinError } from "@/lib/errors";

export async function GET() {
  try {
    const session = await requireSession();
    const domains = await listDomains(session);
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
      await createDomain(
        {
          domain: domainName,
          pass: body.pass,
          user: body.user,
          plan: body.plan,
          parent: body.parent,
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
        const existing = await findDomainByName(domainName, session);
        if (existing) {
          return jsonOk({
            ok: true,
            domain: existing.name,
            note: "Domain already existed in VirtualMin.",
          });
        }
      }
      throw err;
    }

    let created: Awaited<ReturnType<typeof findDomainByName>> | undefined;
    for (let attempt = 0; attempt < 10; attempt++) {
      created = await findDomainByName(domainName, session);
      if (created) break;
      await new Promise((r) => setTimeout(r, 1500));
    }

    if (!created) {
      const listed = await listDomains(session).catch(() => []);
      const hint =
        listed.length === 0
          ? "list-domains returned no domains. Check VIRTUALMIN_TLS_INSECURE and VIRTUALMIN_URL in .env.local, then npm run test-api. "
          : `VirtualMin lists ${listed.length} other domain(s), not ${domainName}. `;
      return jsonError(
        hint +
          "Open Webmin on port 10000 or run virtualmin list-domains on the server.",
        502,
      );
    }

    await auditLog(session.username, "create-domain", domainName);
    return jsonOk({ ok: true, domain: created.name });
  } catch (err) {
    return handleApiError(err);
  }
}
