import { randomBytes } from "node:crypto";

/** One-time panel login password for client users (users.json). */
export function randomPanelPassword(): string {
  return randomBytes(12).toString("base64url").slice(0, 16);
}
