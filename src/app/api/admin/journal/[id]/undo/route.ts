import { requireAdmin } from "@/lib/admin-api";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import {
  beginJournal,
  getEntry,
  isStillUndoable,
  markEntryUndone,
  runUndo,
  UndoNotSupportedError,
  UndoRejectedError,
} from "@/lib/journal";

/**
 * POST /api/admin/journal/:id/undo
 *
 * Idempotent-ish: a second POST after a successful undo returns 409 because
 * the entry is no longer undoable (undoneAt is set).
 *
 * The undo itself is recorded as a NEW journal entry with action
 * "journal.undo" so the audit trail is complete.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!id || !/^[a-z0-9]+$/i.test(id)) {
    return jsonError("Invalid journal id.", 400);
  }
  let undoJournal: ReturnType<typeof beginJournal> | undefined;
  try {
    const session = await requireAdmin();
    const entry = await getEntry(id, 30);
    if (!entry) return jsonError("Journal entry not found.", 404);

    if (entry.undoneAt) {
      return jsonError(
        `Entry was already undone at ${entry.undoneAt} by ${entry.undoneBy ?? "?"}.`,
        409,
      );
    }
    if (!isStillUndoable(entry)) {
      const ttl = entry.undoSpec?.ttlMinutes;
      return jsonError(
        ttl
          ? `Undo window of ${ttl} minute(s) has passed for this entry.`
          : "Entry is not undoable.",
        409,
      );
    }

    undoJournal = beginJournal({
      action: "journal.undo",
      summary: `Undo ${entry.action} - ${entry.summary}`,
      session,
      target: entry.target,
      metadata: {
        originalEntryId: entry.id,
        originalAction: entry.action,
        undoKind: entry.undoSpec?.kind,
      },
    });
    undoJournal.infoStep(
      `Looked up original entry ${entry.id} (action=${entry.action}, started ${entry.startedAt}).`,
    );

    let result;
    try {
      result = await runUndo({ session, entry });
      undoJournal.infoStep(result.summary);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      undoJournal.warnStep(`Undo handler failed: ${msg}`);
      if (e instanceof UndoNotSupportedError) {
        await undoJournal.finish(false, msg);
        return jsonError(msg, 400);
      }
      if (e instanceof UndoRejectedError) {
        await undoJournal.finish(false, msg);
        return jsonError(msg, 400);
      }
      throw e;
    }

    const finishedUndo = await undoJournal.finish(true);
    const updated = await markEntryUndone(
      entry.id,
      session.username,
      finishedUndo.id,
    );

    return jsonOk({
      ok: true,
      summary: result.summary,
      undoEntryId: finishedUndo.id,
      originalEntry: updated,
    });
  } catch (err) {
    if (undoJournal) {
      await undoJournal.finish(
        false,
        err instanceof Error ? err.message : String(err),
      );
    }
    return handleApiError(err);
  }
}
