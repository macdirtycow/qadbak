import { handleApiError, jsonError } from "@/lib/api";
import { getDomainFileDownload, isPanelFilesMode, mimeForFile } from "@/lib/domain-files";
import {
  liveFilesActive,
  readDomainFileLive,
} from "@/lib/domain-files-service";
import { requireDomainApi } from "@/lib/domain-api";
import { VirtualMinError } from "@/lib/virtualmin";

type Params = { params: Promise<{ domain: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const { session, domain } = await requireDomainApi((await params).domain);
    const live = await liveFilesActive();
    if (!isPanelFilesMode() && !live) {
      return jsonError("Download requires native file access on the server.", 501);
    }
    const path = new URL(request.url).searchParams.get("path");
    if (!path) return jsonError("Path is required.");

    let body: Uint8Array;
    let mime: string;
    const filename = path.split("/").pop() ?? "download";
    if (live) {
      const file = await readDomainFileLive(domain, path, session);
      if (file.encoding === "base64") {
        body = Uint8Array.from(Buffer.from(file.content, "base64"));
      } else {
        body = new TextEncoder().encode(file.content);
      }
      mime = file.mime || mimeForFile(filename);
    } else {
      const dl = getDomainFileDownload(path);
      body = dl.body;
      mime = dl.mime;
    }
    return new Response(Buffer.from(body), {
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
        "Content-Length": String(body.length),
      },
    });
  } catch (err) {
    if (err instanceof VirtualMinError) {
      return jsonError(err.message, 400);
    }
    return handleApiError(err);
  }
}
