import { auditLog } from "@/lib/audit";
import { requireAdmin } from "@/lib/admin-api";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import {
  DockerNotAvailableError,
  pullImage,
  removeImage,
  removeVolume,
} from "@/lib/docker/admin-docker";
import {
  assertContainerId,
  assertImageRef,
  assertVolumeName,
} from "@/lib/docker/validate";

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    const body = (await request.json()) as {
      resource?: "image" | "volume";
      action?: string;
      ref?: string;
      name?: string;
      id?: string;
    };

    if (body.resource === "image") {
      if (body.action === "pull") {
        if (!body.ref) return jsonError("Image reference is required.");
        assertImageRef(body.ref);
        await pullImage(body.ref);
        await auditLog(session.username, "docker-image-pull", undefined, body.ref);
        return jsonOk({ ok: true });
      }
      if (body.action === "remove") {
        if (!body.id) return jsonError("Image id is required.");
        assertContainerId(body.id);
        await removeImage(body.id);
        await auditLog(session.username, "docker-image-remove", undefined, body.id);
        return jsonOk({ ok: true });
      }
    }

    if (body.resource === "volume") {
      if (body.action === "remove") {
        if (!body.name) return jsonError("Volume name is required.");
        assertVolumeName(body.name);
        await removeVolume(body.name);
        await auditLog(session.username, "docker-volume-remove", undefined, body.name);
        return jsonOk({ ok: true });
      }
    }

    return jsonError("Unknown action.");
  } catch (err) {
    if (err instanceof DockerNotAvailableError) {
      return jsonError(err.message, 503);
    }
    return handleApiError(err);
  }
}
