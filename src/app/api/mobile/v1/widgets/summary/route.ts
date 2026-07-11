import { handleApiError, jsonOk } from "@/lib/api";
import { runGlobalTool } from "@/lib/panel-tools";
import { getProvisioner } from "@/lib/provisioner";
import { requireSession } from "@/lib/session";

type HealthRow = {
  domain: string;
  disabled?: boolean;
  sslDaysLeft?: number | null;
  backupAgeDays?: number | null;
  websiteOk?: boolean | null;
  dnsPending?: boolean;
  containersStopped?: string[];
  actions?: { severity: string }[];
};

/** Lightweight health snapshot for iOS widgets and push digests. */
export async function GET() {
  try {
    const session = await requireSession();
    const raw = await runGlobalTool("domain-health-batch");
    let rows = ((raw as { domains?: HealthRow[] }).domains ?? []) as HealthRow[];

    if (session.role !== "admin") {
      const allowed = new Set(session.domains.map((d) => d.toLowerCase()));
      rows = rows.filter((d) => allowed.has(d.domain.toLowerCase()));
    } else {
      try {
        const listed = await getProvisioner().listDomains(session);
        const names = new Set(listed.map((d) => d.name.toLowerCase()));
        rows = rows.filter((d) => names.has(d.domain.toLowerCase()));
      } catch {
        /* use batch as-is */
      }
    }

    const sslExpiringSoon = rows.filter(
      (d) => d.sslDaysLeft != null && d.sslDaysLeft <= 14,
    ).length;
    const backupStale = rows.filter(
      (d) => d.backupAgeDays != null && d.backupAgeDays > 7,
    ).length;
    const websitesRunning = rows.filter(
      (d) => !d.disabled && d.websiteOk === true,
    ).length;
    const containersStopped = rows.reduce(
      (n, d) => n + (d.containersStopped?.length ?? 0),
      0,
    );
    const urgentActions = rows.reduce((n, d) => {
      const actions = d.actions ?? [];
      return (
        n +
        actions.filter((a) => a.severity === "error" || a.severity === "warning")
          .length
      );
    }, 0);

    return jsonOk({
      domainCount: rows.length,
      websitesRunning,
      sslExpiringSoon,
      backupStale,
      containersStopped,
      urgentActions,
      updatedAt: new Date().toISOString(),
      domains: rows.slice(0, 8).map((d) => ({
        domain: d.domain,
        sslDaysLeft: d.sslDaysLeft ?? null,
        backupAgeDays: d.backupAgeDays ?? null,
        websiteOk: d.websiteOk ?? null,
        dnsPending: d.dnsPending ?? false,
        disabled: d.disabled ?? false,
        containersStopped: d.containersStopped ?? [],
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
