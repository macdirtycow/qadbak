import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { getDomainFile, isPanelFilesMode } from "@/lib/domain-files";
import {
  liveFilesActive,
  readDomainFileLive,
} from "@/lib/domain-files-service";
import { requireDomainApi } from "@/lib/domain-api";

type Params = { params: Promise<{ domain: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const { session, domain } = await requireDomainApi((await params).domain);
    const live = await liveFilesActive();
    if (!isPanelFilesMode() && !live) {
      return jsonError(
        "Viewing files in Qadbak requires native file access or mock mode.",
        501,
      );
    }
    const url = new URL(request.url);
    const path = url.searchParams.get("path");
    if (!path) return jsonError("Path is required.");
    const file = live
      ? await readDomainFileLive(domain, path, session)
      : getDomainFile(path);
    return jsonOk(file);
  } catch (err) {
    return handleApiError(err);
  }
}
