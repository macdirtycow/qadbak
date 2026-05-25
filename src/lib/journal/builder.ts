/**
 * Fluent API for capturing journal entries from inside an API route.
 *
 * Usage:
 *
 *     const j = beginJournal({
 *       action: "domain.create",
 *       summary: `Create domain ${domainName}`,
 *       session,
 *       target: { domain: domainName },
 *     });
 *     try {
 *       j.step({ kind: "info", summary: "Validated input" });
 *       await j.shell("nginx -t");
 *       await j.captureFromHelper(helperResult);
 *       await j.finish(true);
 *     } catch (e) {
 *       await j.finish(false, e instanceof Error ? e.message : String(e));
 *       throw e;
 *     }
 */

import { randomBytes } from "crypto";
import { performance } from "perf_hooks";
import { persistEntry } from "./store";
import { sanitize, sanitizeMetadata, sanitizeOutput } from "./sanitize";
import type { JournalEntry, JournalStep, JournalStepKind } from "./types";

export interface BeginJournalOpts {
  action: string;
  summary: string;
  session: { id?: string; userId?: string; username: string; role: "admin" | "client" };
  target?: JournalEntry["target"];
  undoable?: boolean;
  metadata?: Record<string, unknown>;
}

export interface StepOpts {
  kind: JournalStepKind;
  summary: string;
  command?: string;
  filePath?: string;
  diffPreview?: string;
  byteSize?: number;
  output?: string;
  externalUrl?: string;
  ok?: boolean;
  errorMessage?: string;
  durationMs?: number;
}

export class JournalBuilder {
  private readonly entry: JournalEntry;
  private readonly startedAtMs: number;
  private finalized = false;

  constructor(opts: BeginJournalOpts) {
    const now = new Date();
    this.startedAtMs = performance.now();
    this.entry = {
      id: makeId(),
      userId: opts.session.userId ?? opts.session.id ?? opts.session.username,
      username: opts.session.username,
      role: opts.session.role,
      action: opts.action,
      summary: opts.summary,
      target: opts.target,
      steps: [],
      ok: true,
      undoable: Boolean(opts.undoable),
      metadata: sanitizeMetadata(opts.metadata),
      startedAt: now.toISOString(),
      finishedAt: now.toISOString(),
      durationMs: 0,
    };
  }

  /** Get a stable ID before the action completes (for client correlation). */
  get id(): string {
    return this.entry.id;
  }

  /** Record an arbitrary step. */
  step(opts: StepOpts): void {
    const ok = opts.ok ?? true;
    if (!ok) this.entry.ok = false;
    const step: JournalStep = {
      kind: opts.kind,
      summary: sanitize(opts.summary),
      command: opts.command ? sanitize(opts.command) : undefined,
      filePath: opts.filePath,
      diffPreview: opts.diffPreview ? sanitizeOutput(opts.diffPreview, 4096) : undefined,
      byteSize: opts.byteSize,
      output: opts.output ? sanitizeOutput(opts.output) : undefined,
      externalUrl: opts.externalUrl,
      durationMs: Math.max(0, Math.round(opts.durationMs ?? 0)),
      ok,
      errorMessage: opts.errorMessage ? sanitize(opts.errorMessage) : undefined,
      startedAt: new Date().toISOString(),
    };
    this.entry.steps.push(step);
  }

  /** Convenience: record a shell command being run. */
  shellStep(command: string, output?: string, ok = true, durationMs = 0): void {
    this.step({
      kind: "shell",
      summary: shortenCommand(command),
      command,
      output,
      ok,
      durationMs,
    });
  }

  /** Convenience: record a file write. */
  fileWriteStep(filePath: string, byteSize?: number, diffPreview?: string): void {
    this.step({
      kind: "file-write",
      summary: `Wrote ${filePath}`,
      filePath,
      byteSize,
      diffPreview,
    });
  }

  /** Convenience: record a service reload. */
  reloadStep(service: string, ok = true): void {
    this.step({
      kind: "service-reload",
      summary: `Reloaded ${service}`,
      ok,
    });
  }

  /** Record an info-level breadcrumb. */
  infoStep(summary: string): void {
    this.step({ kind: "info", summary });
  }

  /** Record a non-fatal warning / failed sub-step (does NOT mark entry failed). */
  warnStep(summary: string, errorMessage?: string): void {
    const step: JournalStep = {
      kind: "info",
      summary: sanitize(summary),
      errorMessage: errorMessage ? sanitize(errorMessage) : undefined,
      durationMs: 0,
      ok: true,
      startedAt: new Date().toISOString(),
    };
    this.entry.steps.push(step);
  }

  /**
   * Merge a list of steps emitted by the native provisioning helper
   * (lines like {"event":"journal-step", ...} on stdout).
   */
  captureFromHelper(steps: JournalStep[] | undefined): void {
    if (!steps || !Array.isArray(steps)) return;
    for (const s of steps) {
      this.step({
        kind: s.kind,
        summary: s.summary,
        command: s.command,
        filePath: s.filePath,
        diffPreview: s.diffPreview,
        byteSize: s.byteSize,
        output: s.output,
        externalUrl: s.externalUrl,
        ok: s.ok,
        errorMessage: s.errorMessage,
        durationMs: s.durationMs,
      });
    }
  }

  /** Finalise + persist. Always safe to call twice — second call is a no-op. */
  async finish(ok: boolean, errorMessage?: string): Promise<JournalEntry> {
    if (this.finalized) return this.entry;
    this.finalized = true;
    this.entry.ok = ok && this.entry.ok;
    if (errorMessage) {
      this.entry.errorMessage = sanitize(errorMessage);
    }
    const now = new Date();
    this.entry.finishedAt = now.toISOString();
    this.entry.durationMs = Math.round(performance.now() - this.startedAtMs);
    await persistEntry(this.entry);
    return this.entry;
  }
}

export function beginJournal(opts: BeginJournalOpts): JournalBuilder {
  return new JournalBuilder(opts);
}

/** Crockford-base32 ish ID. Sortable by time, 16 chars. */
function makeId(): string {
  const ts = Date.now().toString(36).padStart(9, "0");
  const rand = randomBytes(4).toString("hex");
  return `${ts}${rand}`;
}

function shortenCommand(cmd: string): string {
  const trimmed = cmd.trim().replace(/\s+/g, " ");
  if (trimmed.length <= 80) return trimmed;
  return `${trimmed.slice(0, 77)}…`;
}
