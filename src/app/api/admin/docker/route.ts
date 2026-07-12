import { requireAdmin } from "@/lib/admin-api";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import {
  DockerNotAvailableError,
  dockerAvailable,
  listContainers,
  listImages,
  listNetworks,
  listVolumes,
} from "@/lib/docker/admin-docker";

export async function GET() {
  try {
    await requireAdmin();
    const available = await dockerAvailable();
    if (!available) {
      return jsonOk({
        available: false,
        containers: [],
        images: [],
        volumes: [],
        networks: [],
      });
    }
    const [containers, images, volumes, networks] = await Promise.all([
      listContainers(),
      listImages(),
      listVolumes(),
      listNetworks(),
    ]);
    return jsonOk({
      available: true,
      containers,
      images,
      volumes,
      networks,
    });
  } catch (err) {
    if (err instanceof DockerNotAvailableError) {
      return jsonOk({
        available: false,
        error: err.message,
        containers: [],
        images: [],
        volumes: [],
        networks: [],
      });
    }
    return handleApiError(err);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = (await request.json()) as { check?: boolean };
    if (body.check) {
      const ok = await dockerAvailable();
      return jsonOk({ available: ok });
    }
    return jsonError("Unknown action.");
  } catch (err) {
    return handleApiError(err);
  }
}
