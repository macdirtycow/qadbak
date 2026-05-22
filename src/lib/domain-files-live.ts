import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { DomainFileEntry, DomainFileContent } from "./domain-files";
import {
  domainHomePath,
  enrichEntry,
  isDirWritable,
  isTextFileName,
  languageForFile,
  mimeForFile,
  normalizeDir,
} from "./domain-files";
import { VirtualMinError } from "./errors";
import type { VirtualMinDomain } from "./types";
import { listDomains } from "./virtualmin";
import type { Role } from "./types";

const execFileAsync = promisify(execFile);

const HELPER_SCRIPT =
  process.env.QADBAK_DOMAIN_FS_HELPER ??
  "/opt/qadbak/scripts/domain-fs-helper.mjs";
const NODE_BIN = process.env.QADBAK_NODE_PATH ?? "node";
const USE_SUDO = process.env.QADBAK_DOMAIN_FS_SUDO !== "false";

let liveFsProbe: boolean | null = null;

export function liveFilesEnabled(): boolean {
  return (
    process.env.VIRTUALMIN_MOCK !== "true" &&
    process.env.QADBAK_LIVE_FILES !== "false"
  );
}

async function runHelper(
  cmd: string,
  absPath: string,
  payload?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const args = [cmd, absPath];
  if (payload) args.push(JSON.stringify(payload));

  const { stdout } = USE_SUDO
    ? await execFileAsync("sudo", ["-n", NODE_BIN, HELPER_SCRIPT, ...args], {
        timeout: 30_000,
        maxBuffer: 8 * 1024 * 1024,
      })
    : await execFileAsync(NODE_BIN, [HELPER_SCRIPT, ...args], {
        timeout: 30_000,
        maxBuffer: 8 * 1024 * 1024,
      });

  const line = stdout.trim().split("\n").pop() ?? "";
  const parsed = JSON.parse(line) as Record<string, unknown>;
  if (!parsed.ok) {
    throw new VirtualMinError(String(parsed.error ?? "Filesystem command failed."));
  }
  return parsed;
}

export async function probeLiveFilesystem(): Promise<boolean> {
  if (!liveFilesEnabled()) return false;
  if (liveFsProbe !== null) return liveFsProbe;
  try {
    await runHelper("list", "/home");
    liveFsProbe = true;
  } catch {
    liveFsProbe = false;
  }
  return liveFsProbe;
}

async function resolveUnixUser(
  domain: VirtualMinDomain | string,
  actor: { role: Role; domains: string[] },
): Promise<string> {
  if (typeof domain !== "string" && domain.user) return domain.user;
  const name = typeof domain === "string" ? domain : domain.name;
  const rows = await listDomains(actor);
  const row = rows.find((d) => d.name.toLowerCase() === name.toLowerCase());
  if (row?.user) return row.user;
  return domainHomePath(domain).replace(/^\/home\//, "");
}

function absDirFromPanel(unixUser: string, dir: string): string {
  const home = `/home/${unixUser}`;
  const cwd = normalizeDir(dir);
  return cwd ? `${home}/${cwd}` : home;
}

function absFileFromPanel(unixUser: string, panelPath: string): string {
  const home = `/home/${unixUser}`;
  const rel = panelPath.replace(/^\/+/, "");
  return rel ? `${home}/${rel}` : home;
}

export async function listDomainFilesLive(
  domain: VirtualMinDomain | string,
  dir: string,
  actor: { role: Role; domains: string[] },
): Promise<DomainFileEntry[]> {
  const unixUser = await resolveUnixUser(domain, actor);
  const cwd = normalizeDir(dir);
  const abs = absDirFromPanel(unixUser, cwd);
  const data = await runHelper("list", abs);
  const raw = (data.entries ?? []) as Array<{
    name: string;
    path?: string;
    type: string;
    sizeBytes?: number;
    modified?: string;
  }>;
  return raw.map((e) => {
    const panelPath = cwd ? `${cwd}/${e.name}` : e.name;
    return enrichEntry({
      name: e.name,
      path: panelPath.replace(/\/+/g, "/"),
      type: e.type === "dir" ? "dir" : "file",
      sizeBytes: e.sizeBytes,
      modified: e.modified,
      editable:
        e.type !== "dir" &&
        isTextFileName(e.name) &&
        isDirWritable(cwd),
      downloadable: e.type !== "dir",
    });
  });
}

export async function readDomainFileLive(
  domain: VirtualMinDomain | string,
  panelPath: string,
  actor: { role: Role; domains: string[] },
): Promise<DomainFileContent> {
  const unixUser = await resolveUnixUser(domain, actor);
  const abs = absFileFromPanel(unixUser, panelPath);
  const data = await runHelper("read", abs);
  const name = panelPath.split("/").pop() ?? panelPath;
  const parent = panelPath.includes("/")
    ? panelPath.replace(/\/[^/]+$/, "")
    : "";
  const encoding = data.encoding === "base64" ? "base64" : "text";
  return {
    content: String(data.content ?? ""),
    mime: mimeForFile(name),
    language: languageForFile(name),
    readOnly: !isDirWritable(parent),
    encoding,
  };
}

export async function writeDomainFileLive(
  domain: VirtualMinDomain | string,
  panelPath: string,
  content: string,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  const unixUser = await resolveUnixUser(domain, actor);
  const abs = absFileFromPanel(unixUser, panelPath);
  if (!isTextFileName(panelPath.split("/").pop() ?? "")) {
    throw new VirtualMinError("You cannot edit this file type as text.");
  }
  const parent = panelPath.includes("/")
    ? panelPath.replace(/\/[^/]+$/, "")
    : "";
  if (!isDirWritable(parent)) {
    throw new VirtualMinError("This directory is read-only.");
  }
  await runHelper("write", abs, { content });
}

export async function mkdirDomainLive(
  domain: VirtualMinDomain | string,
  parent: string,
  name: string,
  actor: { role: Role; domains: string[] },
): Promise<string> {
  const parentNorm = normalizeDir(parent);
  if (!isDirWritable(parentNorm)) {
    throw new VirtualMinError("This directory is read-only.");
  }
  const unixUser = await resolveUnixUser(domain, actor);
  const base = absDirFromPanel(unixUser, parentNorm);
  const safe = name.replace(/[/\\]/g, "").trim();
  if (!safe || safe === "." || safe === "..") {
    throw new VirtualMinError("Invalid directory name.");
  }
  const abs = `${base}/${safe}`;
  await runHelper("mkdir", abs);
  return parentNorm ? `${parentNorm}/${safe}` : safe;
}

export async function uploadDomainFileLive(
  domain: VirtualMinDomain | string,
  panelPath: string,
  data: Uint8Array,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  const parent = panelPath.includes("/")
    ? panelPath.replace(/\/[^/]+$/, "")
    : "";
  if (!isDirWritable(parent)) {
    throw new VirtualMinError("This directory is read-only.");
  }
  const unixUser = await resolveUnixUser(domain, actor);
  const abs = absFileFromPanel(unixUser, panelPath);
  const base64 = Buffer.from(data).toString("base64");
  await runHelper("write-bytes", abs, { base64 });
}

export async function deleteDomainFileLive(
  domain: VirtualMinDomain | string,
  panelPath: string,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  const parent = panelPath.includes("/")
    ? panelPath.replace(/\/[^/]+$/, "")
    : "";
  if (!isDirWritable(parent)) {
    throw new VirtualMinError("This path is read-only.");
  }
  const unixUser = await resolveUnixUser(domain, actor);
  const abs = absFileFromPanel(unixUser, panelPath);
  await runHelper("unlink", abs);
}
