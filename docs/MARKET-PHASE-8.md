# Market phase 8 — Billing API & integrations

## Delivered

- REST API v1: `GET/POST /api/v1/domains`, `GET/DELETE /api/v1/domains/[domain]`
- API keys: `src/lib/api-keys.ts`, admin UI `/admin/api-keys`
- OpenAPI: `docs/api/openapi.yaml`
- Starter integrations: `integrations/whmcs/`, `integrations/blesta/`

## Auth

```http
Authorization: Bearer qadbak_…
```

Create keys in Admin → API keys. Scopes: `domains:read`, `domains:write`, `backups:read`, etc.

## Exit checklist

- [ ] WHMCS module test create + terminate domain against staging panel
- [ ] Publish integration guide on qadbak.com
- [ ] Rate limit / IP allowlist per key (configured at create time)
