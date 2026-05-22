import { readFile } from "node:fs/promises";
import path from "node:path";
import { QADBAK_DIR } from "./provisioning-common.mjs";

/** Load /opt/qadbak/.env.local into process.env (does not override existing). */
export async function loadEnvLocal() {
  const file = path.join(QADBAK_DIR, ".env.local");
  let text;
  try {
    text = await readFile(file, "utf8");
  } catch {
    return;
  }
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
