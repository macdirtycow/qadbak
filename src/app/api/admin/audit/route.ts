import { requireAdmin } from "@/lib/admin-api";
import { handleApiError, jsonOk } from "@/lib/api";
import { demoAuditMock, demoSandboxActive } from "@/lib/demo-sandbox";
import { readAuditEntries } from "@/lib/audit-read";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await requireAdmin();
    if (demoSandboxActive(session.username)) {
      return jsonOk(demoAuditMock());
    }

    const url = new URL(request.url);
    const sinceParam = url.searchParams.get("since");
    const since =
      sinceParam === "24h"
        ? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        : sinceParam || undefined;

    const { entries, scannedLines } = await readAuditEntries({
      limit: Number(url.searchParams.get("limit") ?? "200"),
      action: url.searchParams.get("action") ?? undefined,
      username: url.searchParams.get("username") ?? undefined,
      since,
    });

    const failedLogins = entries.filter((e) => e.action === "login-failed").length;
    const logins = entries.filter((e) => e.action === "login").length;

    return jsonOk({
      entries,
      scannedLines,
      stats: { failedLogins, logins },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
