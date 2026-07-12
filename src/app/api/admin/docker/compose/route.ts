import { auditLog } from "@/lib/audit";
import { requireAdmin } from "@/lib/admin-api";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import {
  composeDown,
  composePs,
  composeUp,
  DockerNotAvailableError,
  validateComposeYaml,
} from "@/lib/docker/admin-docker";
import { assertComposeProject } from "@/lib/docker/validate";

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const body = (await request.json()) as {
      action?: string;
      project?: string;
      yaml?: string;
    };
    if (!body.action) return jsonError("Action is required.");

    if (body.action === "validate") {
      if (!body.yaml) return jsonError("Compose YAML is required.");
      const message = await validateComposeYaml(body.yaml);
      return jsonOk({ ok: true, message });
    }

    if (!body.project) return jsonError("Project name is required.");
    assertComposeProject(body.project);

    if (body.action === "up") {
      if (!body.yaml) return jsonError("Compose YAML is required.");
      const message = await composeUp(body.project, body.yaml);
      await auditLog(
        session.username,
        "docker-compose-up",
        undefined,
        body.project,
      );
      return jsonOk({ ok: true, message });
    }

    if (body.action === "down") {
      const message = await composeDown(body.project);
      await auditLog(
        session.username,
        "docker-compose-down",
        undefined,
        body.project,
      );
      return jsonOk({ ok: true, message });
    }

    if (body.action === "ps") {
      const output = await composePs(body.project);
      return jsonOk({ output });
    }

    return jsonError("Unknown action.");
  } catch (err) {
    if (err instanceof DockerNotAvailableError) {
      return jsonError(err.message, 503);
    }
    return handleApiError(err);
  }
}
