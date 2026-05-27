import type { VirtualMinDomain } from "./types";
import { VirtualMinError } from "./errors";
import {
  detectArchiveFormat,
  isArchiveFileName,
} from "./domain-files-archives";

export interface DomainFileEntry {
  name: string;
  path: string;
  type: "file" | "dir";
  size?: string;
  sizeBytes?: number;
  modified?: string;
  editable?: boolean;
  downloadable?: boolean;
  /** False only for read-only dirs (logs, Maildir). */
  deletable?: boolean;
  /** Move/rename within the account home. */
  movable?: boolean;
  /** ZIP / TAR archive — extract via panel. */
  archive?: boolean;
  archiveFormat?: ReturnType<typeof detectArchiveFormat>;
}

export interface DomainFilesListing {
  mode: "qadbak" | "virtualmin";
  home: string;
  cwd: string;
  breadcrumbs: { label: string; path: string }[];
  entries?: DomainFileEntry[];
  fileManagerUrl?: string;
  writable?: boolean;
}

export interface DomainFileContent {
  content: string;
  mime: string;
  language: string;
  readOnly: boolean;
  encoding: "text" | "base64";
}

const READ_ONLY_DIR_PREFIXES = ["logs", "Maildir"];

const TEXT_EXTENSIONS = new Set([
  "html",
  "htm",
  "css",
  "js",
  "mjs",
  "json",
  "txt",
  "md",
  "xml",
  "svg",
  "php",
  "cgi",
  "sh",
  "py",
  "yml",
  "yaml",
  "env",
  "htaccess",
  "conf",
  "ini",
  "log",
]);

const LANG_BY_EXT: Record<string, string> = {
  html: "html",
  htm: "html",
  css: "css",
  js: "javascript",
  mjs: "javascript",
  json: "json",
  md: "markdown",
  xml: "xml",
  svg: "xml",
  php: "php",
  cgi: "shell",
  sh: "shell",
  py: "python",
  yml: "yaml",
  yaml: "yaml",
  txt: "plaintext",
  log: "plaintext",
};

const MOCK_TREE: Record<string, DomainFileEntry[]> = {
  "": [
    { name: "public_html", path: "public_html", type: "dir" },
    { name: "cgi-bin", path: "cgi-bin", type: "dir" },
    { name: "logs", path: "logs", type: "dir", editable: false },
    { name: "Maildir", path: "Maildir", type: "dir", editable: false },
  ],
  public_html: [
    {
      name: "index.html",
      path: "public_html/index.html",
      type: "file",
      sizeBytes: 2100,
      modified: "2026-05-18",
      editable: true,
      downloadable: true,
    },
    {
      name: "robots.txt",
      path: "public_html/robots.txt",
      type: "file",
      sizeBytes: 120,
      modified: "2026-01-10",
      editable: true,
      downloadable: true,
    },
    {
      name: ".htaccess",
      path: "public_html/.htaccess",
      type: "file",
      sizeBytes: 340,
      modified: "2026-03-02",
      editable: true,
      downloadable: true,
    },
    { name: "css", path: "public_html/css", type: "dir" },
    { name: "images", path: "public_html/images", type: "dir" },
  ],
  "public_html/css": [
    {
      name: "style.css",
      path: "public_html/css/style.css",
      type: "file",
      sizeBytes: 4500,
      modified: "2026-05-10",
      editable: true,
      downloadable: true,
    },
  ],
  "public_html/images": [
    {
      name: "logo.svg",
      path: "public_html/images/logo.svg",
      type: "file",
      sizeBytes: 8000,
      modified: "2026-04-01",
      editable: true,
      downloadable: true,
    },
  ],
  "cgi-bin": [
    {
      name: "hello.cgi",
      path: "cgi-bin/hello.cgi",
      type: "file",
      sizeBytes: 512,
      modified: "2025-11-20",
      editable: true,
      downloadable: true,
    },
  ],
  logs: [
    {
      name: "access_log",
      path: "logs/access_log",
      type: "file",
      sizeBytes: 128000,
      modified: "2026-05-20",
      editable: false,
      downloadable: true,
    },
    {
      name: "error_log",
      path: "logs/error_log",
      type: "file",
      sizeBytes: 12000,
      modified: "2026-05-20",
      editable: false,
      downloadable: true,
    },
  ],
};

const MOCK_TEXT: Record<string, string> = {
  "public_html/index.html": `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Welcome</title>
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <h1>Website</h1>
  <p>Manage this file in Qadbak.</p>
</body>
</html>`,
  "public_html/robots.txt": "User-agent: *\nDisallow:\n",
  "public_html/.htaccess": "RewriteEngine On\n",
  "public_html/css/style.css": "body {\n  font-family: system-ui, sans-serif;\n  margin: 2rem;\n  color: #e2e8f0;\n  background: #0f172a;\n}\n",
  "public_html/images/logo.svg":
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><text y="28" font-size="18">Logo</text></svg>\n',
  "cgi-bin/hello.cgi":
    "#!/bin/sh\necho \"Content-Type: text/plain\"\necho\necho Hello\n",
  "logs/access_log":
    `[${new Date().toISOString()}] GET / HTTP/1.1 200\n192.0.2.1 - - "GET /index.html" 200\n`,
  "logs/error_log": `[${new Date().toISOString()}] [error] mock error log\n`,
};

/** base64 payload for binary mock files */
const MOCK_BINARY: Record<string, { mime: string; base64: string }> = {};

export function domainUnixUser(domain: VirtualMinDomain | string): string {
  if (typeof domain === "string") {
    return domain.split(".")[0];
  }
  return domain.user ?? domain.name.split(".")[0];
}

export function domainHomePath(domain: VirtualMinDomain | string): string {
  return `/home/${domainUnixUser(domain)}`;
}

export function normalizeDir(dir: string): string {
  return dir.replace(/^\/+/, "").replace(/\/+$/, "");
}

function safeFileName(name: string): string {
  const base = name.replace(/[/\\]/g, "").trim();
  if (!base || base === "." || base === "..") {
    throw new VirtualMinError("Invalid file name.");
  }
  return base;
}

function fileExtension(name: string): string {
  if (name.startsWith(".")) {
    const parts = name.slice(1).split(".");
    return parts.length > 1 ? parts.pop()!.toLowerCase() : name.slice(1).toLowerCase();
  }
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : "";
}

export function isTextFileName(name: string): boolean {
  const ext = fileExtension(name);
  if (!ext) return false;
  if (name === ".htaccess" || name.startsWith(".env")) return true;
  return TEXT_EXTENSIONS.has(ext);
}

export function languageForFile(name: string): string {
  if (name === ".htaccess") return "plaintext";
  const ext = fileExtension(name);
  return LANG_BY_EXT[ext] ?? "plaintext";
}

export function mimeForFile(name: string): string {
  const ext = fileExtension(name);
  const map: Record<string, string> = {
    html: "text/html",
    htm: "text/html",
    css: "text/css",
    js: "text/javascript",
    json: "application/json",
    svg: "image/svg+xml",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    pdf: "application/pdf",
    zip: "application/zip",
    txt: "text/plain",
    php: "application/x-php",
  };
  return map[ext] ?? "application/octet-stream";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function breadcrumbsFor(cwd: string): DomainFilesListing["breadcrumbs"] {
  const crumbs: DomainFilesListing["breadcrumbs"] = [{ label: "Home", path: "" }];
  if (!cwd) return crumbs;
  const parts = cwd.split("/");
  let acc = "";
  for (const part of parts) {
    acc = acc ? `${acc}/${part}` : part;
    crumbs.push({ label: part, path: acc });
  }
  return crumbs;
}

export function isDirWritable(cwd: string): boolean {
  const norm = normalizeDir(cwd);
  return !READ_ONLY_DIR_PREFIXES.some(
    (p) => norm === p || norm.startsWith(`${p}/`),
  );
}

function assertWritableDir(cwd: string): void {
  if (!isDirWritable(cwd)) {
    throw new VirtualMinError("This directory is read-only.");
  }
}

export function enrichEntry(entry: DomainFileEntry): DomainFileEntry {
  const size =
    entry.size ??
    (entry.sizeBytes !== undefined ? formatBytes(entry.sizeBytes) : undefined);
  const archive =
    entry.archive ?? (entry.type === "file" && isArchiveFileName(entry.name));
  const parentDir = entry.path.replace(/\/[^/]+$/, "");
  return {
    ...entry,
    size,
    archive,
    archiveFormat:
      entry.archiveFormat ??
      (archive ? detectArchiveFormat(entry.name) : undefined),
    downloadable: entry.downloadable ?? entry.type === "file",
    editable:
      entry.editable ??
      (entry.type === "file" &&
        !archive &&
        isTextFileName(entry.name) &&
        isDirWritable(parentDir)),
    deletable:
      entry.deletable ??
      (entry.type === "file" && isDirWritable(parentDir)),
    movable: entry.movable ?? isDirWritable(parentDir),
  };
}

function touchEntry(path: string, sizeBytes: number, text = true): void {
  const parent = path.includes("/") ? path.replace(/\/[^/]+$/, "") : "";
  const name = path.split("/").pop() ?? path;
  if (!MOCK_TREE[parent]) MOCK_TREE[parent] = [];
  const idx = MOCK_TREE[parent].findIndex((e) => e.path === path);
  const entry: DomainFileEntry = enrichEntry({
    name,
    path,
    type: "file",
    sizeBytes,
    modified: today(),
    editable: text && isTextFileName(name),
    downloadable: true,
  });
  if (idx >= 0) MOCK_TREE[parent][idx] = entry;
  else MOCK_TREE[parent].push(entry);
}

export function isPanelFilesMode(): boolean {
  return process.env.VIRTUALMIN_MOCK === "true";
}

export function listDomainFiles(
  domain: VirtualMinDomain | string,
  dir: string,
): DomainFilesListing {
  const home = domainHomePath(domain);
  const cwd = normalizeDir(dir);
  const base = {
    home,
    cwd,
    breadcrumbs: breadcrumbsFor(cwd),
    writable: isDirWritable(cwd),
  };

  if (!isPanelFilesMode()) {
    return { ...base, mode: "virtualmin" };
  }

  const entries = (MOCK_TREE[cwd] ?? []).map((e) => enrichEntry({ ...e }));
  return { ...base, mode: "qadbak", entries };
}

export function getDomainFile(path: string): DomainFileContent {
  if (!isPanelFilesMode()) {
    throw new VirtualMinError(
      "File content is only available in Qadbak with VIRTUALMIN_MOCK=true.",
    );
  }
  const name = path.split("/").pop() ?? path;
  const binary = MOCK_BINARY[path];
  if (binary) {
    return {
      content: binary.base64,
      mime: binary.mime,
      language: "plaintext",
      readOnly: !isDirWritable(path.replace(/\/[^/]+$/, "")),
      encoding: "base64",
    };
  }
  const text = MOCK_TEXT[path];
  if (text === undefined) {
    throw new VirtualMinError("File not found.");
  }
  const parent = path.includes("/") ? path.replace(/\/[^/]+$/, "") : "";
  const entry = MOCK_TREE[parent]?.find((e) => e.path === path);
  const readOnly = entry?.editable === false;
  return {
    content: text,
    mime: mimeForFile(name),
    language: languageForFile(name),
    readOnly,
    encoding: "text",
  };
}

export function saveDomainFileContent(path: string, content: string): void {
  if (!isPanelFilesMode()) {
    throw new VirtualMinError(
      "Saving in Qadbak is not available on the live server.",
    );
  }
  const parent = path.includes("/") ? path.replace(/\/[^/]+$/, "") : "";
  assertWritableDir(parent);
  const name = path.split("/").pop() ?? path;
  if (!isTextFileName(name)) {
    throw new VirtualMinError("You cannot edit this file type as text.");
  }
  MOCK_TEXT[path] = content;
  delete MOCK_BINARY[path];
  touchEntry(path, new TextEncoder().encode(content).length);
}

export type DomainFileWriteOptions = {
  /** When true (default for upload), replace an existing file at the same path. */
  overwrite?: boolean;
};

function mockFileExists(path: string): boolean {
  return MOCK_TEXT[path] !== undefined || MOCK_BINARY[path] !== undefined;
}

function clearMockFile(path: string): void {
  delete MOCK_TEXT[path];
  delete MOCK_BINARY[path];
}

export function createDomainFile(
  parent: string,
  name: string,
  content = "",
  options?: DomainFileWriteOptions,
): string {
  if (!isPanelFilesMode()) {
    throw new VirtualMinError("Creating files is not available on the live server.");
  }
  const parentNorm = normalizeDir(parent);
  assertWritableDir(parentNorm);
  const safe = safeFileName(name);
  if (!isTextFileName(safe)) {
    throw new VirtualMinError("You can only create text files here. Upload other types.");
  }
  const path = parentNorm ? `${parentNorm}/${safe}` : safe;
  const overwrite = options?.overwrite !== false;
  if (mockFileExists(path) && !overwrite) {
    throw new VirtualMinError("File already exists.");
  }
  if (mockFileExists(path)) clearMockFile(path);
  MOCK_TEXT[path] = content;
  touchEntry(path, new TextEncoder().encode(content).length);
  return path;
}

export function uploadDomainFile(
  parent: string,
  name: string,
  data: Uint8Array,
  options?: DomainFileWriteOptions,
): string {
  if (!isPanelFilesMode()) {
    throw new VirtualMinError("Upload is not available on the live server.");
  }
  const parentNorm = normalizeDir(parent);
  assertWritableDir(parentNorm);
  const safe = safeFileName(name);
  const path = parentNorm ? `${parentNorm}/${safe}` : safe;
  const overwrite = options?.overwrite !== false;
  if (mockFileExists(path) && !overwrite) {
    throw new VirtualMinError(`File ${safe} already exists. Enable overwrite or rename.`);
  }
  if (mockFileExists(path)) clearMockFile(path);

  const textLike = isTextFileName(safe);
  if (textLike) {
    const decoder = new TextDecoder("utf-8", { fatal: false });
    MOCK_TEXT[path] = decoder.decode(data);
    touchEntry(path, data.length);
    return path;
  }

  MOCK_BINARY[path] = {
    mime: mimeForFile(safe),
    base64: Buffer.from(data).toString("base64"),
  };
  touchEntry(path, data.length, false);
  return path;
}

export function getDomainFileDownload(
  path: string,
): { body: Uint8Array; mime: string; filename: string } {
  if (!isPanelFilesMode()) {
    throw new VirtualMinError("Download is not available on the live server.");
  }
  const name = path.split("/").pop() ?? "download";
  const binary = MOCK_BINARY[path];
  if (binary) {
    return {
      body: new Uint8Array(Buffer.from(binary.base64, "base64")),
      mime: binary.mime,
      filename: name,
    };
  }
  const text = MOCK_TEXT[path];
  if (text === undefined) {
    throw new VirtualMinError("File not found.");
  }
  return {
    body: new TextEncoder().encode(text),
    mime: mimeForFile(name),
    filename: name,
  };
}

function assertMoveAllowed(sourcePath: string, destPath: string): void {
  if (sourcePath === destPath) {
    throw new VirtualMinError("Source and destination are the same.");
  }
  if (destPath.startsWith(`${sourcePath}/`)) {
    throw new VirtualMinError("Cannot move a folder into itself or a subfolder.");
  }
}

function rekeyMockPathPrefix(oldPrefix: string, newPrefix: string): void {
  const remap = (p: string) =>
    p === oldPrefix ? newPrefix : p.startsWith(`${oldPrefix}/`) ? newPrefix + p.slice(oldPrefix.length) : p;

  for (const key of [...Object.keys(MOCK_TREE)]) {
    if (key !== oldPrefix && !key.startsWith(`${oldPrefix}/`)) continue;
    const newKey = remap(key);
    MOCK_TREE[newKey] = (MOCK_TREE[key] ?? []).map((e) =>
      enrichEntry({ ...e, path: remap(e.path) }),
    );
    if (newKey !== key) delete MOCK_TREE[key];
  }

  for (const key of Object.keys(MOCK_TEXT)) {
    if (key === oldPrefix || key.startsWith(`${oldPrefix}/`)) {
      const nk = remap(key);
      MOCK_TEXT[nk] = MOCK_TEXT[key];
      delete MOCK_TEXT[key];
    }
  }
  for (const key of Object.keys(MOCK_BINARY)) {
    if (key === oldPrefix || key.startsWith(`${oldPrefix}/`)) {
      const nk = remap(key);
      MOCK_BINARY[nk] = MOCK_BINARY[key];
      delete MOCK_BINARY[key];
    }
  }
}

export function resolveMoveDestination(
  sourcePath: string,
  destDir: string,
  newName?: string,
): string {
  const safeName = (newName ?? sourcePath.split("/").pop() ?? "")
    .replace(/[/\\]/g, "")
    .trim();
  if (!safeName || safeName === "." || safeName === "..") {
    throw new VirtualMinError("Invalid name.");
  }
  const destNorm = normalizeDir(destDir);
  return destNorm ? `${destNorm}/${safeName}` : safeName;
}

export function moveDomainPath(
  sourcePath: string,
  destDir: string,
  newName?: string,
  options?: DomainFileWriteOptions,
): string {
  if (!isPanelFilesMode()) {
    throw new VirtualMinError("Move is not available on the live server.");
  }
  const srcNorm = sourcePath.replace(/^\/+/, "");
  const destPath = resolveMoveDestination(srcNorm, destDir, newName);
  const srcParent = srcNorm.includes("/") ? srcNorm.replace(/\/[^/]+$/, "") : "";
  const destParent = normalizeDir(destDir);
  assertWritableDir(srcParent);
  assertWritableDir(destParent);
  assertMoveAllowed(srcNorm, destPath);

  const list = MOCK_TREE[srcParent];
  const idx = list?.findIndex((e) => e.path === srcNorm) ?? -1;
  if (!list || idx < 0) throw new VirtualMinError("File or folder not found.");
  const entry = list[idx]!;
  if (entry.editable === false) {
    throw new VirtualMinError("This item is read-only and cannot be moved.");
  }
  const finalName = destPath.split("/").pop() ?? entry.name;
  const overwrite = options?.overwrite === true;
  const existing = MOCK_TREE[destParent]?.find((e) => e.name === finalName);
  if (existing) {
    if (!overwrite) {
      throw new VirtualMinError(
        "An item with that name already exists in the destination folder. Enable replace or choose another name.",
      );
    }
    if (existing.type !== entry.type) {
      throw new VirtualMinError("Cannot replace a file with a folder (or the reverse).");
    }
    if (existing.editable === false) {
      throw new VirtualMinError("The existing destination item is read-only and cannot be replaced.");
    }
    deleteDomainFilePath(existing.path);
  }

  list.splice(idx, 1);
  const moved: DomainFileEntry = enrichEntry({
    ...entry,
    name: finalName,
    path: destPath,
  });
  if (!MOCK_TREE[destParent]) MOCK_TREE[destParent] = [];
  MOCK_TREE[destParent].push(moved);

  if (entry.type === "dir") {
    rekeyMockPathPrefix(srcNorm, destPath);
  } else if (MOCK_TEXT[srcNorm] !== undefined) {
    MOCK_TEXT[destPath] = MOCK_TEXT[srcNorm];
    delete MOCK_TEXT[srcNorm];
  } else if (MOCK_BINARY[srcNorm]) {
    MOCK_BINARY[destPath] = MOCK_BINARY[srcNorm];
    delete MOCK_BINARY[srcNorm];
  }

  return destPath;
}

export function deleteDomainFilePath(path: string): void {
  if (!isPanelFilesMode()) {
    throw new VirtualMinError("Deleting in Qadbak is not available on the live server.");
  }
  const parent = path.includes("/") ? path.replace(/\/[^/]+$/, "") : "";
  const entry = MOCK_TREE[parent]?.find((e) => e.path === path);
  if (entry?.editable === false) {
    throw new VirtualMinError("This file is read-only and cannot be deleted.");
  }
  assertWritableDir(parent);
  delete MOCK_TEXT[path];
  delete MOCK_BINARY[path];
  for (const key of Object.keys(MOCK_TREE)) {
    MOCK_TREE[key] = MOCK_TREE[key].filter(
      (e) => e.path !== path && !e.path.startsWith(`${path}/`),
    );
  }
}

export function createDomainDirectory(parent: string, name: string): string {
  if (!isPanelFilesMode()) {
    throw new VirtualMinError("Creating directories in Qadbak is not available on the live server.");
  }
  const parentNorm = normalizeDir(parent);
  assertWritableDir(parentNorm);
  const safe = safeFileName(name);
  const path = parentNorm ? `${parentNorm}/${safe}` : safe;
  if (!MOCK_TREE[parentNorm]) MOCK_TREE[parentNorm] = [];
  if (MOCK_TREE[parentNorm].some((e) => e.name === safe)) {
    throw new VirtualMinError("Directory already exists.");
  }
  MOCK_TREE[parentNorm].push({ name: safe, path, type: "dir" });
  MOCK_TREE[path] = [];
  return path;
}

export const DOMAIN_FILE_QUICK_PATHS = [
  { id: "public_html", label: "public_html", description: "Website (document root)" },
  { id: "cgi-bin", label: "cgi-bin", description: "CGI-scripts" },
  { id: "logs", label: "logs", description: "Log files (read-only)" },
] as const;
