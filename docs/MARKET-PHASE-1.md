# Market phase 1 — Native production hardening

Gate before market phases 2–8. Run on each production VPS as root.

## Quick check

```bash
cd /opt/qadbak
sudo bash scripts/run-market-phase1-check.sh
```

## E2E matrix (one test domain)

| Step | Panel / API | Native helper |
|------|-------------|---------------|
| Create domain | Domains → New | `domain-create` |
| Website | Repair / Files | `public_html`, nginx vhost |
| Mailbox | Email | `mail-create` |
| DNS A record | DNS | `dns-add` |
| TLS | SSL | `ssl-issue` |
| Database | Databases | `db-create` |
| Cron | Cron | `cron-create` |
| Backup | Backups → Create | `backup-create` |
| Restore (staging) | Backups → Restore | `backup-restore` |

## Exit criteria

- `QADBAK_PROVISIONER=native` and `QADBAK_LEGACY_API_FALLBACK=false` in `.env.local`
- `curl -sS http://127.0.0.1:3000/api/health` shows `provisioner: native`
- `bash scripts/audit-vm-dependency.sh` reports INDEPENDENT mode
- Clients have no legacy panel embed in nav
- Premium: license heartbeat OK, backups + cloud tabs load

See [VM-REMOVAL-ROADMAP.md](./VM-REMOVAL-ROADMAP.md) for per-module status.

## Panel (fase 1)

| Area | Path |
|------|------|
| Health & self-healing | Admin → Health |
| Live metrics | Admin → Status |
| New domain | Domains → New |
| Per domain | Mail, DNS, SSL, Databases, Cron, Backups, Files, Terminal |

**Fase-hub:** Admin → **8 phases** — toont o.a. native provisioner en domain registry checks.
