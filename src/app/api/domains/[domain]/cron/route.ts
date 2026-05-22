import { auditLog } from "@/lib/audit";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { requireDomainApi } from "@/lib/domain-api";
import {
  createCronJob,
  deleteCronJob,
  listCronJobsWithFallback,
} from "@/lib/virtualmin";

type Params = { params: Promise<{ domain: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { session, domain } = await requireDomainApi((await params).domain);
    const jobs = await listCronJobsWithFallback(domain, session);
    return jsonOk({ jobs, canEdit: session.role === "admin" });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { session, domain } = await requireDomainApi((await params).domain);
    if (session.role !== "admin") {
      return jsonError("Only administrators may create cron jobs.", 403);
    }
    const body = (await request.json()) as {
      schedule?: string;
      command?: string;
      user?: string;
    };
    if (!body.schedule || !body.command) {
      return jsonError("Schedule and command are required.");
    }
    await createCronJob(
      domain,
      body.schedule,
      body.command,
      body.user,
      session,
    );
    await auditLog(session.username, "create-cron-job", domain);
    return jsonOk({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { session, domain } = await requireDomainApi((await params).domain);
    if (session.role !== "admin") {
      return jsonError("Only administrators may delete cron jobs.", 403);
    }
    const body = (await request.json()) as { id?: string };
    if (!body.id) return jsonError("Job id is required.");
    await deleteCronJob(domain, body.id, session);
    await auditLog(session.username, "delete-cron-job", domain, body.id);
    return jsonOk({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
