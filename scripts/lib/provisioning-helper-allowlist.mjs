/**
 * Command allowlist for provisioning-helper.mjs — must stay in sync with switch cases.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LIST_PATH = path.join(__dirname, "provisioning-helper-commands.txt");

let cached = null;

export function loadProvisioningCommands() {
  if (cached) return cached;
  const raw = readFileSync(LIST_PATH, "utf8");
  cached = new Set(
    raw
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean),
  );
  return cached;
}

export function assertProvisioningCommand(cmd) {
  const name = String(cmd || "").trim();
  if (!name || !loadProvisioningCommands().has(name)) {
    throw new Error(`Disallowed provisioning command: ${name || "(empty)"}`);
  }
}
