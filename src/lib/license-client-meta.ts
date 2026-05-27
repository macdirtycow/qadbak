import { readFileSync } from "node:fs";
import path from "node:path";
import { installFingerprintTag } from "./install-salt";

/** Metadata sent to the license server on activate/heartbeat. */
export function licenseClientMeta(): {
  fingerprintTag: string | null;
  panelVersion: string;
  publicHost: string;
} {
  let panelVersion = process.env.QADBAK_PANEL_VERSION?.trim() || "";
  if (!panelVersion) {
    try {
      const pkg = JSON.parse(
        readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
      ) as { version?: string };
      panelVersion = String(pkg.version || "0.0.0");
    } catch {
      panelVersion = "0.0.0";
    }
  }
  const publicHost =
    process.env.QADBAK_PUBLIC_HOST?.trim() ||
    process.env.HOSTNAME?.trim() ||
    "unknown";
  return {
    fingerprintTag: installFingerprintTag(),
    panelVersion,
    publicHost,
  };
}
