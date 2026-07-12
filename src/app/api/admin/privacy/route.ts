import { readFile } from "node:fs/promises";
import path from "node:path";
import { auditLog, rotateAuditLogNow } from "@/lib/audit";
import { requireAdmin } from "@/lib/admin-api";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { demoPrivacyReportMock, demoSandboxActive } from "@/lib/demo-sandbox";
import { buildPrivacyReport } from "@/lib/privacy-report";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await requireAdmin();
    const url = new URL(request.url);
    if (url.searchParams.get("export") === "audit") {
      if (demoSandboxActive(session.username)) {
        return new Response("", {
          status: 403,
          headers: { "Content-Type": "text/plain" },
        });
      }
      const logPath = path.join(process.cwd(), "data", "audit.log");
      try {
        const raw = await readFile(logPath, "utf8");
        const lines = raw.trim().split("\n").filter(Boolean);
        const tail = lines.slice(-5000).join("\n");
        return new Response(tail ? `${tail}\n` : "", {
          headers: {
            "Content-Type": "application/x-ndjson",
            "Content-Disposition":
              'attachment; filename="qadbak-audit-log-tail.ndjson"',
            "Cache-Control": "no-store",
          },
        });
      } catch {
        return new Response("", {
          status: 404,
          headers: { "Content-Type": "text/plain" },
        });
      }
    }
    if (demoSandboxActive(session.username)) {
      return jsonOk(await demoPrivacyReportMock());
    }
    const report = await buildPrivacyReport();
    return jsonOk(report);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const body = (await request.json()) as { action?: string };
    if (body.action === "rotate-audit") {
      await rotateAuditLogNow();
      await auditLog(session.username, "audit-rotate");
      const report = demoSandboxActive(session.username)
        ? await demoPrivacyReportMock()
        : await buildPrivacyReport();
      return jsonOk({ ok: true, report });
    }
    return jsonError("Unknown action.");
  } catch (err) {
    return handleApiError(err);
  }
}
