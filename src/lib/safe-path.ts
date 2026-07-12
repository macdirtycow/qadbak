import path from "node:path";

/** Ensure a resolved file path stays within a root directory. */
export function assertPathWithinRoot(rootDir: string, filePath: string): string {
  const root = path.resolve(rootDir);
  const resolved = path.resolve(filePath);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Path escapes allowed directory.");
  }
  return resolved;
}
