import { APP_NAME, APP_SITE } from "@/lib/brand";
import { installFingerprintTag } from "@/lib/install-salt";
import { healthMinimalPublic } from "@/lib/security-config";
import { getProvisionerId } from "@/lib/provisioner";
import { listEnabledNativeFeatures } from "@/lib/provisioner/native-features";
import type { ProvisionerId } from "@/lib/provisioner/types";
import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";

function publicProvisionerId(id: ProvisionerId): string {
  if (id === "legacy-remote") return "legacy-remote";
  return id;
}

async function readOsSummary(): Promise<{
  id?: string;
  version?: string;
  pretty?: string;
} | null> {
  try {
    const text = await readFile("/etc/os-release", "utf8");
    const get = (key: string) => {
      const m = text.match(new RegExp(`^${key}=(.*)$`, "m"));
      return m?.[1]?.replace(/^"|"$/g, "") ?? undefined;
    };
    return {
      id: get("ID"),
      version: get("VERSION_ID"),
      pretty: get("PRETTY_NAME"),
    };
  } catch {
    return null;
  }
}

/** Public liveness check for nginx/monitoring (no auth). */
export async function GET() {
  if (healthMinimalPublic()) {
    return NextResponse.json({
      ok: true,
      mock: process.env.QADBAK_LEGACY_API_MOCK === "true",
    });
  }
  const mock = process.env.QADBAK_LEGACY_API_MOCK === "true";
  const fb = process.env.QADBAK_LEGACY_API_FALLBACK?.trim().toLowerCase();
  const fallback =
    fb === "false" || fb === "0" || fb === "no" ? false : Boolean(fb ?? true);
  const fingerprintTag = installFingerprintTag();
  const os = await readOsSummary();
  return NextResponse.json({
    ok: true,
    app: APP_NAME,
    host: APP_SITE,
    mock,
    installMode: process.env.QADBAK_INSTALL_MODE?.trim() || "native",
    os,
    provisioner: publicProvisionerId(getProvisionerId()),
    legacyApiFallback: fallback,
    nativeFeatures: listEnabledNativeFeatures(),
    fingerprintTag,
    ts: new Date().toISOString(),
  });
}
