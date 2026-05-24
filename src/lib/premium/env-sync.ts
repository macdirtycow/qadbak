import "server-only";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ENV_FILE = path.join(process.cwd(), ".env.local");

export async function syncPremiumFeaturesEnv(features: string[]): Promise<void> {
  const line = `QADBAK_PREMIUM_FEATURES=${features.join(",")}`;
  let content = "";
  try {
    content = await readFile(ENV_FILE, "utf8");
  } catch {
    content = "";
  }
  if (/^QADBAK_PREMIUM_FEATURES=/m.test(content)) {
    content = content.replace(/^QADBAK_PREMIUM_FEATURES=.*$/m, line);
  } else {
    content = `${content.trimEnd()}\n${line}\n`;
  }
  await writeFile(ENV_FILE, content, "utf8");
}

export async function clearPremiumFeaturesEnv(): Promise<void> {
  try {
    let content = await readFile(ENV_FILE, "utf8");
    content = content.replace(/^QADBAK_PREMIUM_FEATURES=.*\n?/m, "");
    await writeFile(ENV_FILE, content, "utf8");
  } catch {
    /* no env file */
  }
}
