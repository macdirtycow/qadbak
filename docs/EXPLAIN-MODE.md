# Explain Mode & Action Journal

> "The hosting panel that explains itself."

Every action in Qadbak that mutates the server is captured in a structured
**Journal Entry** with the exact file writes, shell commands and service
reloads it triggered. Open the Journal in the admin menu, or follow the
"What just happened?" link that appears after each action, to see — and
learn from — what the panel actually did under the hood.

This is Fase 1 of the differentiator roadmap (see chat log "haal hier
functies uit"). Fase 2 will add **Undo** for safe actions. Fase 3 will add
**Self-healing** detection on top of the same journal.

## Where it lives

| Path | What it is |
|------|------------|
| `src/lib/journal/types.ts` | `JournalEntry`, `JournalStep`, `JournalListFilter` |
| `src/lib/journal/sanitize.ts` | Strips passwords, license keys, API tokens, PEM blocks |
| `src/lib/journal/store.ts` | Append-only JSONL: `data/journal/YYYY-MM-DD.jsonl` |
| `src/lib/journal/builder.ts` | `beginJournal({...})` fluent API for API routes |
| `src/lib/journal/helper-stream.ts` | Parses `{"event":"journal-step",...}` from helper stdout |
| `src/lib/provisioner/native-exec.ts` | Captures helper steps; `consumeLastJournalSteps()` |
| `scripts/lib/journal-emit.mjs` | `jstep / jshell / jwrite / jreload / jinfo` for .mjs scripts |
| `src/app/api/admin/journal/route.ts` | `GET /api/admin/journal` (list, filters) |
| `src/app/api/admin/journal/[id]/route.ts` | `GET /api/admin/journal/:id` (detail) |
| `src/app/(app)/admin/journal/page.tsx` | The admin UI |
| `src/components/admin/JournalBrowser.tsx` | Filterable list + step-by-step detail panel |

Journal entries are written to `data/journal/YYYY-MM-DD.jsonl`. One line per
entry, JSON-serialised. Reads scan only the requested day(s) so big histories
don't slow the panel down.

## How to add the journal to a new API route

Three lines of overhead:

```ts
import { beginJournal } from "@/lib/journal";
import { consumeLastJournalSteps } from "@/lib/provisioner/native-exec";

export async function POST(request: Request) {
  let journal: ReturnType<typeof beginJournal> | undefined;
  try {
    const session = await requireAdmin();
    const body = await request.json();

    journal = beginJournal({
      action: "mail.mailbox.add",
      summary: `Add mailbox ${body.local}@${body.domain}`,
      session,
      target: { domain: body.domain, mailbox: body.local },
    });
    consumeLastJournalSteps();

    journal.infoStep("Validated input");
    await doTheThing(body);
    journal.captureFromHelper(consumeLastJournalSteps());

    const entry = await journal.finish(true);
    return jsonOk({ ok: true, journalId: entry.id });
  } catch (err) {
    if (journal) {
      journal.captureFromHelper(consumeLastJournalSteps());
      await journal.finish(false, err instanceof Error ? err.message : String(err));
    }
    return handleApiError(err);
  }
}
```

After this, the action shows up in `/admin/journal` with all the helper
steps (provided the underlying `.mjs` scripts have been instrumented with
`jstep`/`jshell`/`jwrite`).

## How to add `jstep` calls to a native provisioning script

Inside any `scripts/lib/provision-*.mjs` file:

```js
import { jstep, jshell, jwrite, jreload, jinfo } from "./journal-emit.mjs";

jinfo(`Resolved domain '${name}' (type=${type}, user=${user})`);

// Run a command and auto-capture stdout + duration:
await jshell("nginx", ["-t"]);

// Write a file with an auto-generated short diff:
await jwrite(`/etc/nginx/sites-available/${name}.conf`, contents);

// Or annotate something you ran the old way:
jstep("service-reload", `Reloaded nginx`, {
  command: "systemctl reload nginx",
  durationMs: 120,
});
```

Every emit writes a single `{"event":"journal-step",...}` line to stdout
**before** the final `{"ok":true,...}` line. The TS layer's
`extractJournalSteps()` strips them out so they don't break the existing
"last JSON line is the result" parser.

## Privacy & security

The sanitizer in `src/lib/journal/sanitize.ts` redacts:

- `*_PASSWORD=`, `*_SECRET=`, `*_TOKEN=`, `*_KEY=`, `*_JWT=`, `*_CREDENTIALS=` style env assignments
- CLI flags: `--password`, `--token`, `--api-key`, etc.
- Stripe keys (`sk_live_…`, `pk_live_…`, `rk_…`)
- GitHub tokens (`ghp_`, `ghs_`, `gho_`, `ghu_`, `ghr_`)
- Bearer tokens in HTTP headers
- Qadbak license keys (`QAD-XXXX-…`)
- Bcrypt hashes
- PEM-encoded private keys

The same patterns run in `scripts/lib/journal-emit.mjs` so a leak can't
slip through the helper layer either.

The journal directory is not currently chmod-restricted beyond filesystem
defaults — `data/journal/` inherits the same mode as `data/audit.log`. If
your threat model requires it, set `data/journal/` to `0700 qadbak:qadbak`
after install.

## What's wired up today

| Action | Journaled | Undoable | TTL | Inverse |
|---|---|---|---|---|
| `domain.create` | ✅ ~10 steps | ❌ | — | Too many cascading side effects |
| `mailbox.add` | ✅ | ✅ | 60 min | `deleteMailbox(domain, user)` |
| `dns.record.add` | ✅ | ✅ | 60 min | `deleteDnsRecord(domain, record)` |
| `dns.record.delete` | ✅ | ✅ | 60 min | `addDnsRecord(domain, record)` |
| `alias.add` | ✅ | ✅ | 60 min | `deleteAlias(domain, from)` |
| `alias.delete` | ✅ | ✅ if `to` captured | 60 min | `createAlias(domain, from, to)` |

The `alias.delete` route does a best-effort lookup of the current
target before the delete so it can populate the undoSpec — if the
caller didn't pass `{to}` and we can't read it back, the entry warns
that undo is unavailable.

Every other API route still writes the original one-line `auditLog`
entry. Adding journaling is opt-in per route — follow the pattern above.

## Reversible infrastructure (Fase 2 — Undo)

Each undoable action sets `JournalEntry.undoSpec = { kind, payload, warning?, ttlMinutes? }`
at write-time. Admins can POST to `/api/admin/journal/:id/undo` to
reverse it; the dispatcher in `src/lib/journal/undo.ts` switches on
`spec.kind` and runs the matching handler. The undo itself is
recorded as a NEW journal entry with `action: "journal.undo"` so the
audit trail is complete, and the original entry is rewritten in place
with `undoneAt / undoneBy / undoneByEntryId` set.

To make an action undoable from your route:

```ts
journal.setUndoSpec({
  kind: "mailbox.add",
  payload: { domain, user: body.user },
  warning: `This will delete ${body.user}@${domain} and its Maildir.`,
  ttlMinutes: 60,
});
```

Then add a case to the switch in `src/lib/journal/undo.ts`:

```ts
case "mailbox.add":
  return undoMailboxAdd(ctx, spec.payload);
```

Safety rules built into the dispatcher:

- The TTL is enforced server-side via `isStillUndoable()` BEFORE the
  handler runs. The UI also hides the button when the window has
  passed (so the button doesn't taunt the user uselessly).
- Re-clicking Undo on an already-undone entry returns 409.
- The handler is expected to cross-check the entry's `target` against
  the payload (defense in depth — see `undoMailboxAdd` for the pattern).
- All payloads run through `sanitizeMetadata()` before persistence so
  no passwords or tokens end up in the on-disk undoSpec.

In the admin UI, undoable entries show a secondary `Undo` button next
to the success/failure badge. Clicking it opens a confirmation
warning (with the spec's `warning` text + TTL reminder). After undo
the entry shows an "Undone" badge with a link to the undo entry.

## What's next

- **Fase 2 — extend coverage**: roll the same `setUndoSpec` pattern out
  across DNS upserts, file deletes (via a trash directory), database
  creation, and panel-vhost adds. Each is a 10-line change in its
  route + one case in `undo.ts`.
- **Fase 3 — Self-healing**: A scheduled job inspects the last 24h of
  journal entries together with system metrics (disk, RAM, mail queue,
  SSL expiry) and produces plain-English suggestions in `/admin/status`.
  The journal becomes the "what changed recently?" backbone for these
  diagnostics.
- **Fase 4 / Premium — AI assist**: Optional "Explain in plain English"
  button per entry that sends a redacted entry to the user's own
  OpenAI/Anthropic key for a natural-language explanation. Disabled by
  default, key never stored on Qadbak servers.

## Rotation

`pruneJournalsOlderThan(days)` in `src/lib/journal/store.ts` removes
`YYYY-MM-DD.jsonl` files older than the cutoff. There's no scheduler hook
calling it yet — wire it into `scripts/license-heartbeat.sh` or a daily
cron once you've decided on a retention window (suggested: 90 days).
