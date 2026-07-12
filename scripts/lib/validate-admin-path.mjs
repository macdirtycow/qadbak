/**
 * Validate admin-supplied local paths (S3 upload source, etc.).
 */
import { realpath } from "node:fs/promises";
import path from "node:path";

const ALLOWED_PREFIXES = ["/home/", "/opt/qadbak/data/", "/tmp/qadbak-"];

/**
 * @param {string} sourcePath
 * @returns {Promise<string>} resolved absolute path
 */
export async function assertAdminReadablePath(sourcePath) {
  const raw = String(sourcePath || "").trim();
  if (!raw || raw.startsWith("-")) {
    throw new Error("Invalid source path.");
  }
  if (raw.includes("\0") || raw.includes("..")) {
    throw new Error("Invalid source path.");
  }
  const resolved = await realpath(raw).catch(() => {
    throw new Error("Source path does not exist.");
  });
  const ok = ALLOWED_PREFIXES.some((p) => {
    const prefix = p.endsWith("/") ? p : `${p}/`;
    return resolved.startsWith(prefix) || resolved === prefix.slice(0, -1);
  });
  if (!ok) {
    throw new Error(
      "Source path must be under /home/, /opt/qadbak/data/, or /tmp/qadbak-*.",
    );
  }
  return resolved;
}
