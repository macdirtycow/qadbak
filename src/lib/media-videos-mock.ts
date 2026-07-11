import {
  getDomainFileDownload,
  isPanelFilesMode,
  listDomainFiles,
  normalizeDir,
} from "./domain-files";
import {
  isVideoFileName,
  videoMimeForFile,
  type MediaVideoEntry,
} from "./media-library";

function walkMockVideos(
  domain: string,
  cwd: string,
  out: MediaVideoEntry[],
  depth = 0,
): void {
  if (depth > 6 || out.length >= 200) return;
  const listing = listDomainFiles(domain, cwd);
  for (const entry of listing.entries ?? []) {
    if (entry.type === "dir") {
      walkMockVideos(domain, entry.path, out, depth + 1);
      continue;
    }
    if (!isVideoFileName(entry.name)) continue;
    out.push({
      path: entry.path,
      name: entry.name,
      sizeBytes: entry.sizeBytes ?? 0,
      mime: videoMimeForFile(entry.name),
    });
  }
}

export function listMockMediaVideos(
  domain: string,
  mediaPathRelative: string,
): MediaVideoEntry[] {
  if (!isPanelFilesMode()) return [];
  const prefix = normalizeDir(mediaPathRelative || "media");
  const videos: MediaVideoEntry[] = [];
  walkMockVideos(domain, prefix, videos);
  return videos.sort((a, b) => a.name.localeCompare(b.name, "en"));
}

export function readMockVideoSlice(
  path: string,
  start: number,
  end: number,
): { body: Uint8Array; mime: string; filename: string; size: number } {
  const dl = getDomainFileDownload(path);
  const size = dl.body.length;
  const safeEnd = Math.min(end, size - 1);
  const safeStart = Math.max(0, Math.min(start, safeEnd));
  return {
    body: dl.body.slice(safeStart, safeEnd + 1),
    mime: dl.mime,
    filename: dl.filename,
    size,
  };
}
