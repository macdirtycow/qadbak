import { appendFile, mkdir } from "fs/promises";
import path from "path";
import { rotateAuditLogIfNeeded } from "./audit-retention";

const LOG_PATH = path.join(process.cwd(), "data", "audit.log");
let writesSinceRotate = 0;
const ROTATE_EVERY = 50;

export async function auditLog(
  username: string,
  action: string,
  domain?: string,
  detail?: string,
): Promise<void> {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    username,
    action,
    domain,
    detail,
  });
  try {
    await mkdir(path.dirname(LOG_PATH), { recursive: true });
    await appendFile(LOG_PATH, line + "\n", "utf8");
    writesSinceRotate += 1;
    if (writesSinceRotate >= ROTATE_EVERY) {
      writesSinceRotate = 0;
      void rotateAuditLogIfNeeded();
    }
  } catch {
    // non-fatal
  }
}

export async function rotateAuditLogNow(): Promise<void> {
  await rotateAuditLogIfNeeded();
}
