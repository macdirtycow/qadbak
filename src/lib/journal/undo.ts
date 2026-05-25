/**
 * Server-side Undo dispatcher.
 *
 * Each undoable action sets a `JournalEntry.undoSpec = { kind, payload }`
 * at write-time. To undo, the admin POSTs to
 * `/api/admin/journal/:id/undo`; this module resolves the kind to a
 * handler and runs it.
 *
 * Design: a single dispatch table (no plug-in registry) — simpler than
 * dynamic registration and avoids module-load order pitfalls in Next.js
 * route handlers. Adding a new undoable kind = add a case below.
 *
 * Safety:
 *  - Handlers MUST be idempotent or safe to fail mid-way; we don't crash
 *    the panel on a botched undo.
 *  - Handlers MUST refuse to operate on the wrong target (e.g. delete a
 *    mailbox in a different domain than was created).
 *  - TTL is checked by the caller before this module is invoked.
 */

import { getProvisioner } from "@/lib/provisioner";
import type { DnsRecord } from "@/lib/provisioner";
import type { SessionPayload } from "@/lib/types";
import type { JournalEntry } from "./types";

type Session = SessionPayload;

export interface UndoResult {
  ok: boolean;
  summary: string;
}

export interface UndoContext {
  session: Session;
  entry: JournalEntry;
}

export class UndoNotSupportedError extends Error {
  constructor(kind: string) {
    super(`No undo handler registered for kind "${kind}".`);
    this.name = "UndoNotSupportedError";
  }
}

export class UndoRejectedError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "UndoRejectedError";
  }
}

/**
 * Look up and run the undo handler for the entry's undoSpec.kind.
 * Throws UndoNotSupportedError / UndoRejectedError on validation issues.
 */
export async function runUndo(ctx: UndoContext): Promise<UndoResult> {
  const spec = ctx.entry.undoSpec;
  if (!spec) {
    throw new UndoRejectedError("Entry has no undoSpec — it was not flagged as undoable.");
  }
  switch (spec.kind) {
    case "mailbox.add":
      return undoMailboxAdd(ctx, spec.payload);
    case "dns.record.add":
      return undoDnsRecordAdd(ctx, spec.payload);
    case "dns.record.delete":
      return undoDnsRecordDelete(ctx, spec.payload);
    case "alias.add":
      return undoAliasAdd(ctx, spec.payload);
    case "alias.delete":
      return undoAliasDelete(ctx, spec.payload);
    default:
      throw new UndoNotSupportedError(spec.kind);
  }
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Per-kind handlers                                                     */
/* ────────────────────────────────────────────────────────────────────── */

/**
 * Undo a mailbox creation by deleting the mailbox.
 * Payload: { domain: string, user: string }
 * Safe because: the mailbox was just created — no real customer mail can
 * have arrived in the typical 1-hour TTL window.
 */
async function undoMailboxAdd(
  ctx: UndoContext,
  payload: Record<string, unknown>,
): Promise<UndoResult> {
  const domain = stringField(payload, "domain");
  const user = stringField(payload, "user");
  if (!domain || !user) {
    throw new UndoRejectedError("mailbox.add payload missing domain or user");
  }
  assertTargetMatches(ctx, domain);
  await getProvisioner().deleteMailbox(domain, user, ctx.session);
  return {
    ok: true,
    summary: `Deleted mailbox ${user}@${domain} that was created on ${new Date(
      ctx.entry.startedAt,
    ).toLocaleString()}`,
  };
}

/**
 * Undo a DNS record addition by deleting the same record.
 * Payload: { domain, record: DnsRecord }
 * Safe because: the admin just added it; reversing it cleanly removes
 * the line from the BIND zone file and reloads named.
 */
async function undoDnsRecordAdd(
  ctx: UndoContext,
  payload: Record<string, unknown>,
): Promise<UndoResult> {
  const domain = stringField(payload, "domain");
  const record = recordField(payload, "record");
  if (!domain || !record) {
    throw new UndoRejectedError("dns.record.add payload missing domain or record");
  }
  assertTargetMatches(ctx, domain);
  await getProvisioner().deleteDnsRecord(domain, record, ctx.session);
  return {
    ok: true,
    summary: `Removed DNS record ${record.type} ${record.name} → ${record.value} from ${domain}.`,
  };
}

/**
 * Undo a DNS record deletion by re-adding the saved record.
 * Payload: { domain, record: DnsRecord }
 * Safe because: we captured the full record before the delete; re-adding
 * recreates the line with the same TTL/priority.
 */
async function undoDnsRecordDelete(
  ctx: UndoContext,
  payload: Record<string, unknown>,
): Promise<UndoResult> {
  const domain = stringField(payload, "domain");
  const record = recordField(payload, "record");
  if (!domain || !record) {
    throw new UndoRejectedError("dns.record.delete payload missing domain or record");
  }
  assertTargetMatches(ctx, domain);
  await getProvisioner().addDnsRecord(domain, record, ctx.session);
  return {
    ok: true,
    summary: `Re-added DNS record ${record.type} ${record.name} → ${record.value} to ${domain}.`,
  };
}

/**
 * Undo an alias creation by deleting the alias.
 * Payload: { domain, from }
 */
async function undoAliasAdd(
  ctx: UndoContext,
  payload: Record<string, unknown>,
): Promise<UndoResult> {
  const domain = stringField(payload, "domain");
  const from = stringField(payload, "from");
  if (!domain || !from) {
    throw new UndoRejectedError("alias.add payload missing domain or from");
  }
  assertTargetMatches(ctx, domain);
  await getProvisioner().deleteAlias(domain, from, ctx.session);
  return {
    ok: true,
    summary: `Removed alias ${from}@${domain}.`,
  };
}

/**
 * Undo an alias deletion by re-creating the alias.
 * Payload: { domain, from, to }
 */
async function undoAliasDelete(
  ctx: UndoContext,
  payload: Record<string, unknown>,
): Promise<UndoResult> {
  const domain = stringField(payload, "domain");
  const from = stringField(payload, "from");
  const to = stringField(payload, "to");
  if (!domain || !from || !to) {
    throw new UndoRejectedError("alias.delete payload missing domain, from, or to");
  }
  assertTargetMatches(ctx, domain);
  await getProvisioner().createAlias(domain, from, to, ctx.session);
  return {
    ok: true,
    summary: `Re-created alias ${from}@${domain} → ${to}.`,
  };
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Helpers                                                               */
/* ────────────────────────────────────────────────────────────────────── */

function assertTargetMatches(ctx: UndoContext, domain: string): void {
  if (
    ctx.entry.target?.domain &&
    ctx.entry.target.domain.toLowerCase() !== domain.toLowerCase()
  ) {
    throw new UndoRejectedError(
      `Payload domain "${domain}" does not match entry target "${ctx.entry.target.domain}".`,
    );
  }
}

function recordField(
  payload: Record<string, unknown>,
  key: string,
): DnsRecord | undefined {
  const v = payload[key];
  if (!v || typeof v !== "object") return undefined;
  const obj = v as Record<string, unknown>;
  const name = typeof obj.name === "string" ? obj.name : undefined;
  const type = typeof obj.type === "string" ? obj.type : undefined;
  const value = typeof obj.value === "string" ? obj.value : undefined;
  if (!name || !type || !value) return undefined;
  return {
    name,
    type,
    value,
    ttl: typeof obj.ttl === "string" ? obj.ttl : undefined,
    priority: typeof obj.priority === "string" ? obj.priority : undefined,
  };
}

function stringField(
  payload: Record<string, unknown>,
  key: string,
): string | undefined {
  const v = payload[key];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

/** Returns true iff the entry can still be undone right now. */
export function isStillUndoable(entry: JournalEntry, now = Date.now()): boolean {
  if (!entry.undoable || !entry.undoSpec) return false;
  if (entry.undoneAt) return false;
  const ttl = entry.undoSpec.ttlMinutes;
  if (ttl && ttl > 0) {
    const ageMs = now - new Date(entry.startedAt).getTime();
    if (ageMs > ttl * 60_000) return false;
  }
  return true;
}
