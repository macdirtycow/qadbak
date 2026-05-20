import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { getDomainFile, isPanelFilesMode } from "@/lib/domain-files";
import { requireDomainApi } from "@/lib/domain-api";

type Params = { params: Promise<{ domain: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    await requireDomainApi((await params).domain);
    if (!isPanelFilesMode()) {
      return jsonError("Viewing files in Nexmin is only available in mock mode.", 501);
    }
    const url = new URL(request.url);
    const path = url.searchParams.get("path");
    if (!path) return jsonError("Path is required.");
    const file = getDomainFile(path);
    return jsonOk(file);
  } catch (err) {
    return handleApiError(err);
  }
}
