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

- `domain.create` — full end-to-end coverage. Each create generates ~10 steps:
  unix user creation, public_html mkdir, .qadbak-domain marker file,
  ownership chown, PHP-FPM pool apply, nginx vhost apply, registry update,
  BIND zone, PHP config, Postfix/Dovecot mail setup, and the Repair step.
- Every other API route still writes the original one-line `auditLog`
  entry. Adding journaling is opt-in per route — follow the pattern above.

## What's next

- **Fase 2** — `JournalEntry.undoable` + `undoSpec` are already in the schema.
  The next iteration adds an Undo button on entries where a reverse action
  is safe (e.g. domain delete restoring the registry row + vhost).
- **Fase 3** — A scheduled job inspects the last 24h of journal entries
  together with system metrics (disk, RAM, mail queue, SSL expiry) and
  produces self-healing suggestions in `/admin/status`.
- **Fase 4 / Premium** — Optional "AI assist" button per entry that sends a
  redacted entry to the user's own OpenAI/Anthropic key for a plain-English
  explanation. Disabled by default, key never stored on Qadbak servers.

## Rotation

`pruneJournalsOlderThan(days)` in `src/lib/journal/store.ts` removes
`YYYY-MM-DD.jsonl` files older than the cutoff. There's no scheduler hook
calling it yet — wire it into `scripts/license-heartbeat.sh` or a daily
cron once you've decided on a retention window (suggested: 90 days).
