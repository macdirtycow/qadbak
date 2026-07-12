# Qadbak API Endpoint Security Inventory

Generated from static analysis of `src/app/api/**/route.ts` (139 routes).

Legend:
- **Auth:** handler-level guard (middleware also enforces JWT except `public*` and `/api/v1/*`)
- **Rate:** explicit route rate limit, or inherited via `requireSession` / `requireApiV1`

| Path | Methods | Auth | Rate |
|------|---------|------|------|
| /api/admin/admins | GET,POST,DELETE | requireAdmin | requireSession |
| /api/admin/alerts | GET,POST,PATCH | requireAdmin | requireSession |
| /api/admin/api-keys | GET,POST,DELETE | requireAdmin | requireSession |
| /api/admin/apps | GET | requireAdmin | requireSession |
| /api/admin/apps/catalog | GET | requireAdmin | requireSession |
| /api/admin/apps/install | POST | requireAdmin | requireSession |
| /api/admin/audit | GET | requireAdmin | requireSession |
| /api/admin/awstats | GET | requireAdmin | requireSession |
| /api/admin/branding | GET,PUT | requireAdmin | requireSession |
| /api/admin/cloud | POST | requireAdmin | requireSession |
| /api/admin/cloud-credentials | GET,POST | requireAdmin | requireSession |
| /api/admin/cluster-nodes | GET,POST | requireAdmin | requireSession |
| /api/admin/cron | GET | requireAdmin | requireSession |
| /api/admin/docker | GET,POST | requireAdmin | requireSession |
| /api/admin/docker/compose | POST | requireAdmin | requireSession |
| /api/admin/docker/containers | POST | requireAdmin | requireSession |
| /api/admin/docker/resources | POST | requireAdmin | requireSession |
| /api/admin/domains/{domain}/panel-client | GET,POST | requireAdmin | requireSession |
| /api/admin/fail2ban | GET | requireAdmin | requireSession |
| /api/admin/firewall | GET,POST | requireAdmin | requireSession |
| /api/admin/health | GET | requireAdmin | requireSession |
| /api/admin/host-metrics | GET | requireAdmin | requireSession |
| /api/admin/journal | GET | requireAdmin | requireSession |
| /api/admin/journal/{id} | GET | requireAdmin | requireSession |
| /api/admin/journal/{id}/undo | POST | requireAdmin | requireSession |
| /api/admin/legacy-panel/link | GET | requireAdmin | requireSession |
| /api/admin/license | GET,POST | requireAdmin | requireSession |
| /api/admin/license/activations | GET,DELETE | requireAdmin | requireSession |
| /api/admin/metrics-history | GET,POST | requireAdmin | explicit |
| /api/admin/networking | GET | requireAdmin | requireSession |
| /api/admin/nodes | GET,POST | requireAdmin | requireSession |
| /api/admin/nodes/ping-cluster | POST | requireAdmin | requireSession |
| /api/admin/nodes/provision | POST | requireAdmin | requireSession |
| /api/admin/panel-control | GET,POST | requireAdmin | requireSession |
| /api/admin/panel-policy | GET,POST | requireAdmin | requireSession |
| /api/admin/plans | GET,POST,DELETE | requireAdmin | requireSession |
| /api/admin/privacy | GET,POST | requireAdmin | requireSession |
| /api/admin/resellers | GET,POST,DELETE | requireAdmin | requireSession |
| /api/admin/security-snapshot | GET | requireAdmin | requireSession |
| /api/admin/server | GET,POST | requireAdmin | requireSession |
| /api/admin/stack | GET,POST | requireAdmin | requireSession |
| /api/admin/system | GET,POST | requireAdmin | requireSession |
| /api/admin/templates | GET | requireAdmin | requireSession |
| /api/admin/terminal/ws-token | GET | requireAdmin | requireSession |
| /api/admin/updates/linux | GET,POST | requireAdmin | requireSession |
| /api/admin/updates/qadbak | GET,POST | requireAdmin | requireSession |
| /api/admin/updates/ubuntu-release | GET,POST | requireAdmin | requireSession |
| /api/admin/vm-status | GET | requireAdmin | requireSession |
| /api/auth/login | POST | public + login RL | explicit |
| /api/auth/logout | POST | middleware JWT | — |
| /api/auth/me | GET | getSession | middleware |
| /api/auth/mobile | POST | public + login RL | explicit |
| /api/auth/mobile/logout | POST | requireSession | requireSession |
| /api/auth/mobile/refresh | POST | public + refresh RL | explicit |
| /api/auth/totp | GET,POST | requireSession | requireSession |
| /api/branding | GET | public | — |
| /api/branding/logo | GET | public | — |
| /api/contact/submit | POST | public | 10/hr IP |
| /api/demo/info | GET | public (demo host) | — |
| /api/domains | GET | requireSession | requireSession |
| /api/domains | POST | requireAdmin | requireSession |
| /api/domains/health-overview | GET | getSession | middleware |
| /api/domains/{domain} | GET | requireSession | requireSession |
| /api/domains/{domain}/* | various | requireDomainApi (+ admin gates) | requireSession |
| /api/domains/{domain}/disable | POST | requireAdmin + domain | requireSession |
| /api/domains/{domain}/enable | POST | requireAdmin + domain | requireSession |
| /api/domains/{domain}/git-webhook | POST | deploy secret | — |
| /api/domains/{domain}/repair-website | POST | requireAdmin | requireSession |
| /api/health | GET | public | — |
| /api/mobile/v1/me | GET | requireSession | requireSession |
| /api/mobile/v1/push/register | POST,DELETE | requireSession | requireSession |
| /api/mobile/v1/widgets/summary | GET | requireSession | requireSession |
| /api/newsletter/confirm | GET | public | 30/hr IP |
| /api/newsletter/subscribe | POST | public | 10/hr IP |
| /api/newsletter/track | GET | public | — |
| /api/newsletter/unsubscribe | GET,POST | public | 30/hr IP |
| /api/server/check-config | GET | requireAdmin | requireSession |
| /api/v1/domains | GET,POST | requireApiV1 | key RL |
| /api/v1/plans | GET,POST | requireApiV1 | key RL |
| /api/v1/domains/{domain} | GET,DELETE | requireApiV1 + scope | key RL |
| /api/v1/domains/{domain}/backups | GET,POST | requireApiV1 | key RL |
| /api/v1/domains/{domain}/dns | GET,POST | requireApiV1 | key RL |
| /api/v1/domains/{domain}/limits | GET,PATCH | requireApiV1 | key RL |
| /api/v1/domains/{domain}/mail | GET,POST | requireApiV1 | key RL |
| /api/v1/domains/{domain}/ssl | GET,POST | requireApiV1 | key RL |
| /api/v1/domains/{domain}/suspend | POST | requireApiV1 | key RL |

Domain-scoped routes (`/api/domains/{domain}/…`) uniformly call `requireDomainApi()` unless noted above. Additional role checks (e.g. backup restore admin-only, media upload admin-only) are enforced inside individual handlers.
