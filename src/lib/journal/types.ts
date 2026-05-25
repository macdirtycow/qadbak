/**
 * Qadbak Action Journal — types
 *
 * Every panel action that mutates the server (create domain, add mailbox,
 * issue cert, …) writes a JournalEntry. Each entry contains the high-level
 * intent (action + summary) plus an ordered list of low-level steps with the
 * exact file writes, shell commands and service reloads that took place.
 *
 * Goal: turn every panel click into a teaching moment by surfacing exactly
 * what Linux just did. See docs/EXPLAIN-MODE.md for the rationale.
 */

/** What kind of low-level operation a step represents. */
export type JournalStepKind =
  | "shell"
  | "file-write"
  | "file-delete"
  | "service-reload"
  | "external-http"
  | "external-script"
  | "info"
  | "error";

/** A single low-level operation captured during an action. */
export interface JournalStep {
  kind: JournalStepKind;
  /** Human-readable one-liner. Shown collapsed by default. */
  summary: string;
  /** Sanitized shell command (kind=shell). */
  command?: string;
  /** Absolute path on disk (kind=file-*). */
  filePath?: string;
  /** First ~40 lines of unified diff (kind=file-write). */
  diffPreview?: string;
  /** New file size in bytes (kind=file-write/file-delete). */
  byteSize?: number;
  /** Sanitized stdout/stderr — truncated to ~4 KB. */
  output?: string;
  /** URL contacted for external calls. */
  externalUrl?: string;
  /** Wall-clock duration of this step. */
  durationMs: number;
  /** Whether the step succeeded; false implies the overall action failed too. */
  ok: boolean;
  /** Optional error if the step failed. Sanitized. */
  errorMessage?: string;
  /** ISO 8601 timestamp this step started. */
  startedAt: string;
}

/** A complete record of a single panel action. */
export interface JournalEntry {
  /** ULID-style identifier. Stable for linking. */
  id: string;
  /** Acting panel user (NOT a unix user). */
  userId: string;
  username: string;
  role: "admin" | "client" | "system";
  /** Dotted action namespace, e.g. "domain.create", "mail.mailbox.add". */
  action: string;
  /** Human-readable summary, e.g. "Created domain example.com". */
  summary: string;
  /** Optional targets — used for filtering and cross-linking in the UI. */
  target?: {
    domain?: string;
    mailbox?: string;
    database?: string;
    user?: string;
  };
  /** Ordered low-level steps. */
  steps: JournalStep[];
  /** True if the whole action succeeded (every step.ok === true). */
  ok: boolean;
  /** Sanitized top-level error message when ok=false. */
  errorMessage?: string;
  /** Whether this action can be undone via a future Fase-2 endpoint. */
  undoable: boolean;
  /** Free-form metadata (sanitized). E.g. { plan: "starter", ip: "1.2.3.4" }. */
  metadata?: Record<string, unknown>;
  startedAt: string;
  finishedAt: string;
  /** Wall-clock duration of the whole action in ms. */
  durationMs: number;
}

/** Filter for the list endpoint. All fields are AND-combined. */
export interface JournalListFilter {
  /** YYYY-MM-DD; defaults to today if missing. */
  date?: string;
  /** Days to scan backward when no explicit date is set. Default 7, max 30. */
  days?: number;
  /** Panel username (case-insensitive contains-match). */
  user?: string;
  /** Dotted action prefix, e.g. "domain." matches all domain.* actions. */
  action?: string;
  /** Limit results. Default 100, max 500. */
  limit?: number;
  /** ok=false only filter. */
  failuresOnly?: boolean;
  /** Target domain (exact match). */
  domain?: string;
}
