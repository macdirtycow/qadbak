import { handleApiError, jsonOk } from "@/lib/api";
import { getSession } from "@/lib/session";
import { runGlobalTool } from "@/lib/panel-tools";
import { getProvisioner } from "@/lib/provisioner";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return jsonOk({ domains: [] });
    }
    const raw = await runGlobalTool("domain-health-batch");
    let domains = (raw as { domains?: { domain: string }[] }).domains ?? [];
    if (session.role !== "admin") {
      const allowed = new Set(session.domains.map((d) => d.toLowerCase()));
      domains = domains.filter((d) => allowed.has(d.domain.toLowerCase()));
    } else {
      try {
        const listed = await getProvisioner().listDomains(session);
        const names = new Set(listed.map((d) => d.name.toLowerCase()));
        domains = domains.filter((d) => names.has(d.domain.toLowerCase()));
      } catch {
        /* use batch as-is */
      }
    }
    return jsonOk({ domains });
  } catch (err) {
    return handleApiError(err);
  }
}
