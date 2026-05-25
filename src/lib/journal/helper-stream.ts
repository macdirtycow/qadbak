/**
 * Parse `{"event":"journal-step", ...}` lines emitted by the native
 * provisioning helper. The helper script normally emits exactly one final
 * `{ok:..., ...}` line; with journal events it emits any number of step
 * events before the final result.
 *
 * This module extracts the step events into typed JournalStep objects
 * without disturbing the existing "last JSON line is the result" convention.
 */

import type { JournalStep, JournalStepKind } from "./types";

interface RawJournalEvent {
  event: "journal-step";
  kind: JournalStepKind;
  summary: string;
  command?: string;
  filePath?: string;
  diffPreview?: string;
  byteSize?: number;
  output?: string;
  externalUrl?: string;
  durationMs?: number;
  ok?: boolean;
  errorMessage?: string;
  startedAt?: string;
}

const VALID_KINDS: ReadonlySet<JournalStepKind> = new Set([
  "shell",
  "file-write",
  "file-delete",
  "service-reload",
  "external-http",
  "external-script",
  "info",
  "error",
]);

/** Extract every journal-step event from a stdout blob (any order). */
export function extractJournalSteps(stdout: string): JournalStep[] {
  const steps: JournalStep[] = [];
  for (const rawLine of stdout.split("\n")) {
    const line = rawLine.trim();
    if (!line.startsWith("{") || !line.includes('"journal-step"')) continue;
    let parsed: RawJournalEvent;
    try {
      parsed = JSON.parse(line) as RawJournalEvent;
    } catch {
      continue;
    }
    if (parsed?.event !== "journal-step") continue;
    if (!VALID_KINDS.has(parsed.kind)) continue;
    steps.push({
      kind: parsed.kind,
      summary: String(parsed.summary ?? "(no summary)"),
      command: parsed.command,
      filePath: parsed.filePath,
      diffPreview: parsed.diffPreview,
      byteSize: typeof parsed.byteSize === "number" ? parsed.byteSize : undefined,
      output: parsed.output,
      externalUrl: parsed.externalUrl,
      durationMs:
        typeof parsed.durationMs === "number" ? parsed.durationMs : 0,
      ok: parsed.ok !== false,
      errorMessage: parsed.errorMessage,
      startedAt: parsed.startedAt ?? new Date().toISOString(),
    });
  }
  return steps;
}
