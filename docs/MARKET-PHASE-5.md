# Market phase 5 — Granular restore

## Delivered

- `backup-archive-list`, `backup-restore-file`, `backup-restore-database` in `provision-backup.mjs`
- API `/api/domains/[domain]/backups/archive` (GET browse, POST partial restore)
- UI wizard in `BackupsManager` (clients: `public_html/` only; DB restore admin-only)

## Exit checklist

- [ ] Client restores deleted `public_html/index.html` from yesterday’s archive without admin
- [ ] Admin restores single MySQL database from archive
- [ ] Audit log entries for partial restores
