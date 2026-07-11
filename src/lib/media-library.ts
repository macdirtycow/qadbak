export type MediaLibraryStatus = {
  installed: boolean;
  parentDomain?: string;
  subdomain?: string;
  adminUrl?: string;
  mediaPath?: string;
  mediaPathRelative?: string;
  mediaUsedBytes?: number;
  mediaFileCount?: number;
  diskLimitMb?: number | null;
  homeUsedBytes?: number;
  containerStatus?: string;
  installedAt?: string;
  installUrl?: string;
  message?: string;
};

export type MediaVideoEntry = {
  path: string;
  name: string;
  sizeBytes: number;
  mime: string;
};

export const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "ogv", "m4v", "mov"]);

export function isVideoFileName(name: string): boolean {
  const idx = name.lastIndexOf(".");
  if (idx < 0) return false;
  return VIDEO_EXTENSIONS.has(name.slice(idx + 1).toLowerCase());
}

export function videoMimeForFile(name: string): string {
  const ext = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
  const map: Record<string, string> = {
    mp4: "video/mp4",
    m4v: "video/mp4",
    webm: "video/webm",
    ogv: "video/ogg",
    mov: "video/quicktime",
  };
  return map[ext] ?? "video/mp4";
}

export function parseByteRange(
  header: string | null,
  size: number,
): { start: number; end: number } | null {
  if (!header || !header.startsWith("bytes=")) return null;
  const [range] = header.replace(/bytes=/, "").split(",");
  const [startRaw, endRaw] = range.split("-");
  let start = startRaw ? parseInt(startRaw, 10) : 0;
  let end = endRaw ? parseInt(endRaw, 10) : size - 1;
  if (!Number.isFinite(start) || start < 0) start = 0;
  if (!Number.isFinite(end) || end >= size) end = size - 1;
  if (start > end || start >= size) return null;
  return { start, end };
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n >= 10 || i === 0 ? n.toFixed(0) : n.toFixed(1)} ${units[i]}`;
}

export function quotaPercent(usedBytes: number, limitMb: number | null | undefined): number | null {
  if (!limitMb || limitMb <= 0) return null;
  const limitBytes = limitMb * 1024 * 1024;
  if (limitBytes <= 0) return null;
  return Math.min(100, Math.round((usedBytes / limitBytes) * 100));
}
