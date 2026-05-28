# Market phase 4 — Cloud offsite backups

## Delivered

- Encrypted credential store: `scripts/lib/cloud-credentials.mjs` → `data/cloud-credentials.json`
- Post-backup upload: `scripts/lib/backup-offsite.mjs` (AWS CLI S3, B2/GCS via endpoint)
- Per-domain policy: `backup-policy.json` via `backup-policy-get` / `backup-policy-set`
- Admin UI: `AdminCloudCredentials` on `/admin/cloud`
- Domain UI: offsite toggle on Backups (admin)

## Requirements

- Set `QADBAK_SECRETS_KEY` (16+ chars) in `.env.local`
- `aws` CLI on host (provision-admin installs for Premium)

## Exit checklist

- [ ] Save B2/S3 credentials in panel
- [ ] Enable offsite on test domain; create backup; object appears in bucket
- [ ] Retention still governed by `backups.json` retain + local prune

## Panel (fase 4)

| Step | Path |
|------|------|
| Save S3/B2/GCS credentials | Admin → **Cloud (S3)** |
| Enable offsite per domain | Domains → Backups → offsite policy |
| List remote objects | Backups → remote list (after upload) |

Requires `QADBAK_SECRETS_KEY` in `.env.local`.
