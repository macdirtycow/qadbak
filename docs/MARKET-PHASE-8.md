# Market phase 8 — Billing API & integrations

## Delivered

- REST API v1: domains, suspend, mail, DNS, SSL, backups (incl. remote pull/restore)
- API keys with scopes + rate limit + reseller domain filter
- OpenAPI: `docs/api/openapi.yaml`
- WHMCS module: create, terminate, suspend, unsuspend
- Starter Blesta: `integrations/blesta/`

## Auth

```http
Authorization: Bearer qadbak_…
```

Create keys in Admin → API keys. Scopes: `domains:read`, `domains:write`, `backups:read`, etc.

## Exit checklist

- [ ] WHMCS module test create + terminate domain against staging panel
- [ ] Publish integration guide on qadbak.com
- [ ] Rate limit / IP allowlist per key (configured at create time)

## Panel (fase 8)

| Area | Path |
|------|------|
| Create / revoke keys | Admin → **API keys** |
| OpenAPI + WHMCS links | API keys page → Integrations card |
| Reseller scoping | Admin → Resellers + key reseller tag |

Example:

```bash
curl -sS -H "Authorization: Bearer qadbak_…" \
  https://panel.example.com/api/v1/domains
```
