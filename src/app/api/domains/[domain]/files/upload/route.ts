import { auditLog } from "@/lib/audit";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { isPanelFilesMode, normalizeDir, uploadDomainFile } from "@/lib/domain-files";
import {
  liveFilesActive,
  uploadDomainFileLive,
} from "@/lib/domain-files-service";
import { requireDomainApi } from "@/lib/domain-api";
import { VirtualMinError } from "@/lib/virtualmin";

type Params = { params: Promise<{ domain: string }> };

const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request, { params }: Params) {
  try {
    const { session, domain } = await requireDomainApi((await params).domain);
    const live = await liveFilesActive();
    if (!isPanelFilesMode() && !live) {
      return jsonError("Upload requires native file access on the server.", 501);
    }

    const form = await request.formData();
    const dir = String(form.get("dir") ?? "");
    const parentNorm = normalizeDir(dir);
    const files = form.getAll("files");
    if (files.length === 0) return jsonError("No files received.");

    const uploaded: string[] = [];
    for (const item of files) {
      if (!(item instanceof File)) continue;
      if (item.size > MAX_BYTES) {
        return jsonError(`File ${item.name} is larger than 10 MB.`);
      }
      const safe = item.name.replace(/[/\\]/g, "").trim();
      if (!safe) throw new VirtualMinError("Invalid file name.");
      const bytes = new Uint8Array(await item.arrayBuffer());
      const rel = parentNorm ? `${parentNorm}/${safe}` : safe;
      if (live) {
        await uploadDomainFileLive(domain, rel, bytes, session);
      } else {
        uploadDomainFile(dir, item.name, bytes);
      }
      uploaded.push(rel);
      await auditLog(session.username, "upload-file", domain, rel);
    }

    if (uploaded.length === 0) return jsonError("No valid files received.");
    return jsonOk({ uploaded });
  } catch (err) {
    return handleApiError(err);
  }
}
