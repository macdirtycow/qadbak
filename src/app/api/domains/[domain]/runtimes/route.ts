import { auditLog } from "@/lib/audit";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { requireDomainApi } from "@/lib/domain-api";
import { getProvisioner } from "@/lib/provisioner";

type Params = { params: Promise<{ domain: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { session, domain } = await requireDomainApi((await params).domain);
    const raw = await getProvisioner().getRuntimes(domain, session);
    return jsonOk({
      runtimes: raw.runtimes ?? { apps: [] },
      phpFpmSocket: raw.phpFpmSocket ?? "",
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { session, domain } = await requireDomainApi((await params).domain);
    if (session.role !== "admin") {
      return jsonError("Only administrators can install runtimes.", 403);
    }
    const body = (await request.json()) as {
      action?: string;
      name?: string;
      port?: number;
      subpath?: string;
    };
    const name = body.name?.trim() || "app";
    const port = Number(body.port) || 3000;
    let result: Record<string, unknown> = {};
    switch (body.action) {
      case "node":
        result = await getProvisioner().installNodeRuntime(
          domain,
          name,
          port,
          body.subpath,
          session,
        );
        await auditLog(session.username, "runtimes-node", domain, name);
        break;
      case "python":
        result = await getProvisioner().installPythonRuntime(domain, name, port, session);
        await auditLog(session.username, "runtimes-python", domain, name);
        break;
      case "docker":
        result = await getProvisioner().installDockerRuntime(domain, name, session);
        await auditLog(session.username, "runtimes-docker", domain, name);
        break;
      default:
        return jsonError("Unknown action. Use node, python, or docker.");
    }
    return jsonOk({ ok: true, result });
  } catch (err) {
    return handleApiError(err);
  }
}
