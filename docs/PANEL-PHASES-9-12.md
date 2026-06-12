# Panel phases 9–12 (Tools+)

Extended hosting features shipped after market phases 1–8. All are available under **Domains → Tools+** for admin and client users (admin can assist).

## Fase 9 — Mail & deliverability

| Feature | Helper | Notes |
|---------|--------|-------|
| DMARC wizard | `dmarc-get`, `dmarc-set` | TXT `_dmarc`, optional BIND apply |
| Mailbox autoresponder | `mailbox-autoreply-*` | Per-mailbox vacation text |
| Mail bounces | `mail-bounces-list` | Recent postfix bounces |
| Newsletter tracking | `newsletter-stats-get`, `newsletter-track-record` | Open pixel + click redirect |
| PostgreSQL | `db-create` type `postgres` | Requires postgresql package |

## Fase 10 — Website & apps

| Feature | Helper | Notes |
|---------|--------|-------|
| Analytics | `analytics-summary` | Nginx/Apache access log top pages |
| Git deploy | `git-deploy-*` | Pull into `public_html` |
| WordPress toolkit | `wp-toolkit-*` | `wp core update` when WP present |
| Maintenance mode | `maintenance-*` | `.maintenance` flag in public_html |
| Contact form | `contact-form-*` | Public `POST /api/contact/submit` |

## Fase 11 — Resources & staging

| Feature | Helper | Notes |
|---------|--------|-------|
| Staging | `staging-sync` | `~/staging/public_html` rsync |
| Bandwidth / disk history | `bandwidth-usage` | Points in domain-config JSON |
| Redis | `redis-set` | Prefix config for apps |
| SSH keys | `ssh-keys-*` | Domain user `authorized_keys` |
| AWStats | `awstats-config` | Config snippet + data dir |

## Fase 12 — Business & cluster

| Feature | Helper | Notes |
|---------|--------|-------|
| Support tickets | `tickets-*` | Per-domain ticket store |
| Invoices (light) | `billing-invoice-*` | Draft invoices JSON |
| Multi-server nodes | `nodes-health`, `nodes-register` | Admin API `/api/admin/cluster-nodes` |
| CardDAV contacts | `carddav-*` | Contact export; full CardDAV via Radicale optional |

## API

```http
POST /api/domains/{domain}/tools
{ "action": "dmarc-get" }
{ "action": "git-deploy-run" }
```

Public:

- `POST /api/contact/submit` — contact forms (CORS)
- `GET /api/newsletter/track?domain=&kind=open|c&c=&e=` — tracking pixel / click redirect

## Verify

```bash
cd /opt/qadbak
node scripts/provisioning-helper.mjs dmarc-get example.com
node scripts/provisioning-helper.mjs analytics-summary example.com
```
