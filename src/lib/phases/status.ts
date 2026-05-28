import "server-only";

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadAppCatalog } from "../apps/catalog";
import { listApiKeys } from "../api-keys";
import { isIndependentMode } from "../provisioner/native-stub";
import { MARKET_PHASES, type PhaseId } from "./catalog";

export type PhaseCheck = {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
};

export type PhaseStatus = {
  phase: PhaseId;
  score: number;
  checks: PhaseCheck[];
  ready: boolean;
};

async function lineCount(file: string): Promise<number> {
  try {
    const raw = await readFile(file, "utf8");
    return raw.trim().split("\n").filter(Boolean).length;
  } catch {
    return 0;
  }
}

function nativeFeatures(): string[] {
  const raw = process.env.QADBAK_NATIVE_FEATURES ?? "";
  return raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export async function buildPhaseStatuses(): Promise<PhaseStatus[]> {
  const root = process.cwd();
  const features = nativeFeatures();
  const catalog = await loadAppCatalog();
  const keys = await listApiKeys();

  const statuses: PhaseStatus[] = [];

  for (const phase of MARKET_PHASES) {
    const checks: PhaseCheck[] = [];

    if (phase.id === 1) {
      checks.push({
        id: "native",
        label: "Native provisioner",
        ok: isIndependentMode(),
        detail: process.env.QADBAK_PROVISIONER ?? "unset",
      });
      const fb = process.env.QADBAK_LEGACY_API_FALLBACK?.toLowerCase();
      checks.push({
        id: "fallback",
        label: "Legacy API fallback off",
        ok: fb === "false" || fb === "0" || fb === "no",
        detail: process.env.QADBAK_LEGACY_API_FALLBACK ?? "unset",
      });
      checks.push({
        id: "domains",
        label: "Domain registry",
        ok: existsSync(path.join(root, "data", "native-domains.json")),
        detail: existsSync(path.join(root, "data", "native-domains.json"))
          ? "native-domains.json"
          : "missing",
      });
    }

    if (phase.id === 2) {
      checks.push({
        id: "catalog",
        label: "App catalog file",
        ok: catalog.length >= 5,
        detail: `${catalog.length} apps`,
      });
      checks.push({
        id: "scripts-feature",
        label: "scripts feature flag",
        ok: features.includes("scripts"),
        detail: features.includes("scripts") ? "enabled" : "add scripts to QADBAK_NATIVE_FEATURES",
      });
    }

    if (phase.id === 3) {
      checks.push({
        id: "runtimes-feature",
        label: "runtimes feature flag",
        ok: features.includes("runtimes"),
        detail: features.includes("runtimes") ? "enabled" : "add runtimes to QADBAK_NATIVE_FEATURES",
      });
    }

    if (phase.id === 4) {
      const creds = existsSync(path.join(root, "data", "cloud-credentials.json"));
      checks.push({
        id: "creds",
        label: "Cloud credentials",
        ok: creds,
        detail: creds ? "configured" : "Admin → Cloud",
      });
      checks.push({
        id: "secrets-key",
        label: "QADBAK_SECRETS_KEY",
        ok: (process.env.QADBAK_SECRETS_KEY?.length ?? 0) >= 16,
        detail: process.env.QADBAK_SECRETS_KEY ? "set" : "missing in .env.local",
      });
    }

    if (phase.id === 5) {
      checks.push({
        id: "backups-feature",
        label: "backups feature",
        ok: features.includes("backup") || features.includes("backups"),
        detail: "archive restore via Domains → Backups",
      });
    }

    if (phase.id === 6) {
      const hist = path.join(root, "data", "metrics-history.jsonl");
      const n = await lineCount(hist);
      checks.push({
        id: "metrics",
        label: "Metrics history",
        ok: n >= 4,
        detail: n ? `${n} snapshots` : "run metrics-snapshot cron",
      });
      const alerts = existsSync(path.join(root, "data", "alert-rules.json"));
      checks.push({
        id: "alerts",
        label: "Alert rules file",
        ok: alerts,
        detail: alerts ? "alert-rules.json" : "configure on Status page",
      });
    }

    if (phase.id === 7) {
      checks.push({
        id: "security-feature",
        label: "security feature",
        ok: features.includes("security"),
        detail: features.includes("security") ? "enabled" : "add security to QADBAK_NATIVE_FEATURES",
      });
    }

    if (phase.id === 8) {
      checks.push({
        id: "api-keys",
        label: "API keys",
        ok: keys.length > 0,
        detail: `${keys.length} key(s)`,
      });
      const withAllow = keys.filter((k) => k.ipAllowlist.length > 0).length;
      checks.push({
        id: "ip-allow",
        label: "Keys with IP allowlist",
        ok: withAllow > 0 || keys.length === 0,
        detail: `${withAllow} of ${keys.length}`,
      });
    }

    const score =
      checks.length === 0
        ? 100
        : Math.round(
            (checks.filter((c) => c.ok).length / checks.length) * 100,
          );
    statuses.push({
      phase: phase.id,
      checks,
      score,
      ready: score >= 80,
    });
  }

  return statuses;
}

export async function phasesSummary(): Promise<{
  phases: PhaseStatus[];
  overallPercent: number;
  readyCount: number;
}> {
  const phases = await buildPhaseStatuses();
  const overallPercent = Math.round(
    phases.reduce((s, p) => s + p.score, 0) / phases.length,
  );
  return {
    phases,
    overallPercent,
    readyCount: phases.filter((p) => p.ready).length,
  };
}
