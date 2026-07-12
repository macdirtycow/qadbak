/**
 * Safe archive extraction — rejects zip/tar slip (path traversal) before extract.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);

/**
 * @param {string} memberPath
 */
export function assertSafeArchiveMember(memberPath) {
  const normalized = memberPath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized === ".") return;
  if (normalized.includes("\0")) {
    throw new Error("Invalid archive entry.");
  }
  const parts = normalized.split("/").filter(Boolean);
  if (parts.some((p) => p === "..")) {
    throw new Error("Archive contains path traversal entries.");
  }
  if (path.isAbsolute(memberPath)) {
    throw new Error("Archive contains absolute paths.");
  }
}

/**
 * @param {string[]} entries
 */
export function assertSafeArchiveEntries(entries) {
  for (const entry of entries) {
    assertSafeArchiveMember(entry);
  }
}

/**
 * @param {string} archivePath
 * @returns {Promise<string[]>}
 */
export async function listTarEntries(archivePath) {
  const isGz = /\.(tar\.gz|tgz)$/i.test(archivePath);
  const args = isGz ? ["-tzf", archivePath] : ["-tf", archivePath];
  const { stdout } = await execFileAsync("tar", args, {
    maxBuffer: 32 * 1024 * 1024,
  });
  return stdout
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

/**
 * @param {string} archivePath
 * @returns {Promise<string[]>}
 */
export async function listZipEntries(archivePath) {
  const { stdout } = await execFileAsync("unzip", ["-Z1", archivePath], {
    maxBuffer: 32 * 1024 * 1024,
  });
  return stdout
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

/**
 * @param {"zip"|"tar.gz"|"tar"} kind
 * @param {string} archivePath
 * @param {string} destDir
 */
export async function safeExtractArchive(kind, archivePath, destDir) {
  const entries =
    kind === "zip"
      ? await listZipEntries(archivePath)
      : await listTarEntries(archivePath);
  assertSafeArchiveEntries(entries);

  if (kind === "zip") {
    await execFileAsync("unzip", ["-q", "-o", archivePath, "-d", destDir], {
      maxBuffer: 16 * 1024 * 1024,
    });
  } else if (kind === "tar.gz") {
    await execFileAsync("tar", ["-xzf", archivePath, "-C", destDir], {
      maxBuffer: 16 * 1024 * 1024,
    });
  } else {
    await execFileAsync("tar", ["-xf", archivePath, "-C", destDir], {
      maxBuffer: 16 * 1024 * 1024,
    });
  }
}
