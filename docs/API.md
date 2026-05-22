# VirtualMin API — MVP command reference

Qadbak calls go through `src/lib/virtualmin.ts` with RBAC. Direct `remote.cgi` access is server-side only.

## Domains

| Action | program | Key parameters |
|--------|---------|----------------|
| List | `list-domains` | `multiline=` (only on `list-*`; other programs use `simple-multiline=` with `json=1`) |
| Detail | `list-domains` | filter client-side on `name` |
| Disable | `disable-domain` | `domain` |
| Enable | `enable-domain` | `domain` |
| VirtualMin link | `create-login-link` | `domain`, `user` (optional) |

Help: `get-command` + `name=<program>`

## Email

| Action | program | Parameters |
|--------|---------|------------|
| List | `list-users` | `domain`, `multiline=` |
| Create | `create-user` | `domain`, `user`, `pass`, `quota` (optional) |
| Update | `modify-user` | `domain`, `user`, `pass` |
| Delete | `delete-user` | `domain`, `user` |

## Databases

| Action | program | Parameters |
|--------|---------|------------|
| List | `list-databases` | `domain`, `multiline=` |
| Create | `create-database` | `domain`, `name`, `pass`, `type` (mysql/postgres) |
| Password | `modify-database-pass` | `domain`, `name`, `pass` |

Test locally: `npm run test-api` (requires curl + `.env.local`).
