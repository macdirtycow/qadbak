import { auditLog } from "@/lib/audit";
import { requireAdmin } from "@/lib/admin-api";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import {
  containerAction,
  containerLogs,
  DockerNotAvailableError,
} from "@/lib/docker/admin-docker";
import { assertContainerId, assertDockerAction } from "@/lib/docker/validate";

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const body = (await request.json()) as {
      action?: string;
      id?: string;
      tail?: number;
    };
    if (!body.action) return jsonError("Action is required.");
    if (!body.id) return jsonError("Container id is required.");

    assertContainerId(body.id);

    if (body.action === "logs") {
      const logs = await containerLogs(body.id, body.tail ?? 200);
      return jsonOk({ logs });
    }

    assertDockerAction(body.action);
    await containerAction(body.id, body.action);
    await auditLog(
      session.username,
      `docker-container-${body.action}`,
      undefined,
      body.id,
    );
    return jsonOk({ ok: true });
  } catch (err) {
    if (err instanceof DockerNotAvailableError) {
      return jsonError(err.message, 503);
    }
    return handleApiError(err);
  }
}
