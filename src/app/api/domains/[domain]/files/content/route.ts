import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { getDomainFile, isPanelFilesMode } from "@/lib/domain-files";
import {
  liveFilesEnabled,
  readDomainFileLive,
} from "@/lib/domain-files-service";
import { requireDomainApi } from "@/lib/domain-api";

type Params = { params: Promise<{ domain: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const { session, domain } = await requireDomainApi((await params).domain);
    const url = new URL(request.url);
    const path = url.searchParams.get("path");
    if (!path) return jsonError("Path is required.");

    if (isPanelFilesMode()) {
      return jsonOk(getDomainFile(path));
    }

    if (!liveFilesEnabled()) {
      return jsonError(
        "Native file access is disabled. Set QADBAK_LIVE_FILES or use mock mode for development.",
        501,
      );
    }

    const file = await readDomainFileLive(domain, path, session);
    return jsonOk(file);
  } catch (err) {
    return handleApiError(err);
  }
}
