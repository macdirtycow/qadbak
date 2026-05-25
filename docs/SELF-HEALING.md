# Self-Healing Health Checks (Fase 3)

> "The hosting panel that catches itself before it falls."

A continuously-evaluated set of checks that flag the most common Linux
hosting problems — full disks, expiring certs, dead daemons, swapping
RAM — in plain English. Every finding includes:

1. **A short title** so you can scan a list and triage.
2. **A plain-English explanation** of why it matters (no `systemctl
   failed` jargon).
3. **The raw evidence** we based the finding on (commands and their
   output, file paths, numbers).
4. **A suggested fix** in plain English.
5. **A copy-paste shell command** that performs that fix.

Open `Admin → Health` to see the current report.

## Architecture

| Path | What it is |
|------|------------|
| `src/lib/health/types.ts` | `HealthFinding`, `HealthCheck`, `HealthReport` |
| `src/lib/health/run.ts` | Parallel runner with per-check timeouts + error capture |
| `src/lib/health/checks/disk.ts` | Disk-full detection (>85% warn, >95% critical) |
| `src/lib/health/checks/memory.ts` | RAM pressure + heavy swap detection |
| `src/lib/health/checks/ssl.ts` | Let's Encrypt expiry scan from `/etc/letsencrypt/live/` |
| `src/lib/health/checks/services.ts` | `systemctl is-active` probe for the hosting stack |
| `src/app/api/admin/health/route.ts` | `GET /api/admin/health` — admin-only |
| `src/app/(app)/admin/health/page.tsx` | The admin UI page |
| `src/components/admin/HealthBrowser.tsx` | Cards grouped by severity, copyable commands |

## What's checked today

| Category | Trigger | Severity |
|---|---|---|
| Disk usage | >85% full on `/`, `/home`, `/var` | warning |
| Disk usage | >95% full | critical |
| Memory | RAM used >85% OR available <200 MB | warning |
| Memory | RAM used >95% OR available <100 MB | critical |
| Memory | Swap >50% used | info / warning |
| SSL | Cert expires in 4–14 days | warning |
| SSL | Cert expires in 0–3 days | critical |
| SSL | Cert already expired | critical |
| Services | nginx / mariadb / postfix / dovecot down or missing | critical |
| Services | named (BIND) / fail2ban down (after install) | warning (optional) |
| Services | named (BIND) / fail2ban never installed | silently skipped |

## Adding a new check

Drop a file in `src/lib/health/checks/` exporting a `HealthCheck`:

```ts
import type { HealthCheck, HealthFinding } from "../types";

export const myCheck: HealthCheck = {
  id: "my-check",
  label: "My new check",
  timeoutMs: 5_000,
  async run(): Promise<HealthFinding[]> {
    // Inspect the system, return zero or more findings.
    return [];
  },
};
```

Then append it to `DEFAULT_HEALTH_CHECKS` in `src/lib/health/checks/index.ts`.

That's it — the runner handles timeouts, errors, sorting and aggregation.

## Design rules

- **Plain English first**. If a finding's `explanation` reads like a
  stack trace, rewrite it. Beginners are part of the target audience.
- **Always provide evidence**. The user must be able to verify what
  we saw with their own eyes (commands, file paths, numbers).
- **Suggest a fix in 1 line**. If the fix takes a paragraph, link to
  docs and pick the simplest copy-pasteable command.
- **Sanitize output**. All evidence + error messages run through the
  Journal's `sanitize()` redactor — passwords/keys/tokens never leak.
- **No auto-fixes (yet)**. Fase 3 is detect + explain only. Auto-fixes
  land in a follow-up — they need a separate audit story (each one
  should write a Journal entry tagged `health.autofix.<kind>` so undo
  works too).
- **Optional services degrade gracefully**. `named` (BIND) and
  `fail2ban` produce only `warning`, not `critical`, because some
  installs intentionally omit them.

## What's next

- **Mail queue check** — flag postfix queues >100 deferred, with a
  copy-command to inspect `mailq | grep MAILER-DAEMON`.
- **PM2 restart-loop check** — parse `pm2 jlist`, flag processes
  with rising restart counts.
- **Backup freshness** — flag domains whose newest `/home/<u>/backups/`
  tarball is older than N days.
- **Auto-fix endpoint** — POST `/api/admin/health/fix/:id` that calls
  a registered fixer for the finding `id` and writes a Journal entry.
  Start with the safest one: `SSL renewal`.
- **Scheduled polling** — a small cron-managed script that runs the
  same checks every 5 minutes and stores the report in
  `data/health/latest.json` so the dashboard loads instantly.
- **AI assist** — optional per-finding "Explain like I'm five" button
  using the customer's own OpenAI/Anthropic key.
