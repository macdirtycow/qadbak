# Market phase 5 — Granular restore

## Delivered

- `backup-archive-list`, `backup-restore-file`, `backup-restore-database` in `provision-backup.mjs`
- API `/api/domains/[domain]/backups/archive` (GET browse, POST partial restore)
- UI wizard in `BackupsManager` (clients: `public_html/` only; DB restore admin-only)

## Exit checklist

- [ ] Client restores deleted `public_html/index.html` from yesterday’s archive without admin
- [ ] Admin restores single MySQL database from archive
- [ ] Audit log entries for partial restores

## Panel (fase 5)

1. Domains → Backups → pick archive → **Browse**
2. Select file under `public_html/` (clients) or database name (admin)
3. Confirm restore — entry in Activity log + journal

Fase 4/5 hint card shown on Backups when native mode.
