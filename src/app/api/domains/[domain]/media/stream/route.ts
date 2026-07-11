import { spawn } from "node:child_process";
import { Readable } from "node:stream";
import { handleApiError, jsonError } from "@/lib/api";
import { requireDomainApi } from "@/lib/domain-api";
import { isPanelFilesMode } from "@/lib/domain-files";
import { DOMAIN_FS_SUDO_WRAPPER } from "@/lib/domain-fs-sudo";
import { parseByteRange } from "@/lib/media-library";
import { readMockVideoSlice } from "@/lib/media-videos-mock";
import { runProvisioningHelper } from "@/lib/provisioner/native-exec";

type Params = { params: Promise<{ domain: string }> };

export const maxDuration = 3600;
export const dynamic = "force-dynamic";

function streamHeaders(
  mime: string,
  size: number,
  range: { start: number; end: number } | null,
  filename: string,
): { headers: Record<string, string>; status: number } {
  if (range) {
    const length = range.end - range.start + 1;
    return {
      status: 206,
      headers: {
        "Content-Type": mime,
        "Content-Length": String(length),
        "Content-Range": `bytes ${range.start}-${range.end}/${size}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600",
        "Content-Disposition": `inline; filename="${filename.replace(/"/g, "")}"`,
      },
    };
  }
  return {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Length": String(size),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
      "Content-Disposition": `inline; filename="${filename.replace(/"/g, "")}"`,
    },
  };
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { domain } = await requireDomainApi((await params).domain);
    const path = new URL(request.url).searchParams.get("path")?.trim();
    if (!path || path.includes("..")) {
      return jsonError("Invalid video path.");
    }

    if (isPanelFilesMode()) {
      const full = readMockVideoSlice(path, 0, Number.MAX_SAFE_INTEGER);
      const range = parseByteRange(request.headers.get("range"), full.size);
      const start = range?.start ?? 0;
      const end = range?.end ?? full.size - 1;
      const slice = readMockVideoSlice(path, start, end);
      const { headers, status } = streamHeaders(full.mime, full.size, range, full.filename);
      return new Response(Buffer.from(slice.body), { status, headers });
    }

    const resolved = await runProvisioningHelper(
      "jellyfin-stream-resolve",
      domain,
      JSON.stringify({ path }),
    );
    const absPath = String(resolved.absPath ?? "");
    const sizeBytes = Number(resolved.sizeBytes ?? 0);
    const mime = String(resolved.mime ?? "video/mp4");
    const filename = String(resolved.name ?? "video.mp4");
    if (!absPath || sizeBytes <= 0) {
      return jsonError("Video not found.", 404);
    }

    const range = parseByteRange(request.headers.get("range"), sizeBytes);
    const start = range?.start ?? 0;
    const end = range?.end ?? sizeBytes - 1;
    const payload = JSON.stringify({ start, end });

    const child = spawn(
      "sudo",
      ["-n", DOMAIN_FS_SUDO_WRAPPER, "stream", absPath, payload],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    if (!child.stdout) return jsonError("Could not open video stream.", 500);

    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-2000);
    });

    const exitPromise = new Promise<number | null>((resolve) => {
      child.on("close", (code) => resolve(code));
      child.on("error", () => resolve(-1));
    });

    const web = Readable.toWeb(child.stdout) as ReadableStream<Uint8Array>;
    const { headers, status } = streamHeaders(mime, sizeBytes, range, filename);

    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = web.getReader();
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value?.length) controller.enqueue(value);
          }
          const code = await exitPromise;
          if (code !== 0 && code !== null) {
            controller.error(new Error(stderr.trim() || `Stream failed (exit ${code})`));
            return;
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        } finally {
          reader.releaseLock();
        }
      },
    });

    return new Response(body, { status, headers });
  } catch (err) {
    return handleApiError(err);
  }
}
