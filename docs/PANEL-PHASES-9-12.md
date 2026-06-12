# Site tools (internal rollout waves 9–12)

Extended hosting features for customer domains. The panel shows **Site tools** with four tabs — never phase numbers in the UI.

| Tab | Internal wave | Scope |
|-----|---------------|-------|
| Deliverability | 9 | DMARC, autoresponder, bounces, newsletter stats, GDPR export, templates, segments |
| Website | 10 | Analytics, Git deploy, WordPress, maintenance, contact forms, 404 monitor, CI pipeline |
| Staging & access | 11 | Staging sync/promote, bandwidth, Redis, Memcached, MongoDB, SSH keys, AWStats, subdomains |
| Support & billing | 12 | Tickets, invoices, CardDAV contacts |

## Deliverability

| Feature | Helper | Notes |
|---------|--------|-------|
| Deliverability score | `deliverability-dashboard` | SPF/DKIM/DMARC score |
| DMARC wizard | `dmarc-get`, `dmarc-set` | TXT `_dmarc`, optional BIND apply |
| Mailbox autoresponder | `mailbox-autoreply-*` | Dovecot Sieve apply |
| Mail bounces | `mail-bounces-list` | Recent postfix bounces |
| Bounce suppress | `bounce-suppress-*` | Unsubscribes newsletter on suppress |
| Newsletter tracking | `newsletter-stats-get`, `newsletter-track-record` | Open pixel + click redirect |
| GDPR export | `newsletter-gdpr-export` | Subscriber CSV |
| Templates / segments | `newsletter-template-*`, `newsletter-segment-*` | Reusable campaign assets |
| PostgreSQL | `db-create` type `postgres` | Requires postgresql package |

## Website

| Feature | Helper | Notes |
|---------|--------|-------|
| Analytics | `analytics-summary`, `analytics-history` | Access log top pages + history |
| Git deploy | `git-deploy-*`, webhook route | Pull into `public_html`, rollback |
| WordPress toolkit | `wp-toolkit-*` | Core/plugins/security/backup |
| WooCommerce | `woocommerce-status` | Detect when plugin present |
| Maintenance mode | `maintenance-*`, `maintenance-nginx` | Flag file + nginx snippet |
| Contact form | `contact-form-*`, `contact-form-embed` | Public `POST /api/contact/submit` |
| 404 monitor | `seo-404-scan` | Top missing URLs from logs |
| CI pipeline | `ci-pipeline-*` | Post-deploy shell command |

## Staging & access

| Feature | Helper | Notes |
|---------|--------|-------|
| Staging | `staging-sync`, `staging-promote`, `staging-vhost` | `~/staging/public_html` |
| Bandwidth / traffic | `bandwidth-usage`, `bandwidth-traffic` | Disk + log bytes |
| Redis / Memcached | `redis-set`, `memcached-set` | Prefix config for apps |
| MongoDB | `mongo-create` | Per-domain DB credentials JSON |
| SSH keys | `ssh-keys-*` | Domain user `authorized_keys` |
| AWStats | `awstats-config`, `awstats-run` | Config snippet + report |
| Subdomains | `subdomain-add` | Extra vhost under domain |

## Support & billing

| Feature | Helper | Notes |
|---------|--------|-------|
| Support tickets | `tickets-*`, `ticket-notify` | Per-domain ticket store |
| Invoices (light) | `billing-invoice-*`, `invoice-mark-sent` | Draft invoices JSON |
| Multi-server nodes | `nodes-health`, `nodes-register`, `nodes-ping-health` | Admin → Nodes |
| CardDAV contacts | `carddav-*`, `carddav-export-vcf` | Contact list + vCard export |
| Panel policy | `panel-policy-*` | Admin → Panel policy (client 2FA requirement) |

## API

```http
POST /api/domains/{domain}/tools
{ "action": "dmarc-get" }
{ "action": "git-deploy-run" }
```

Public:

- `POST /api/contact/submit` — contact forms (CORS)
- `GET /api/newsletter/track?domain=&kind=open|click&c=&e=&url=` — tracking pixel / click redirect
- `POST /api/domains/{domain}/git-webhook` — header `X-Qadbak-Deploy-Secret`

Admin:

- `GET|POST /api/admin/panel-policy`
- `GET|POST /api/admin/nodes`

## Verify

```bash
cd /opt/qadbak
node scripts/provisioning-helper.mjs deliverability-dashboard example.com
node scripts/provisioning-helper.mjs analytics-summary example.com
```
