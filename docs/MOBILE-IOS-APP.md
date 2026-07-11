# Qadbak iOS app — Phase A (mobile API)

Native SwiftUI app (Phase B) talks to your existing Qadbak panel over HTTPS. Phase A adds **Bearer token auth** so the app can use the same domain APIs as the web panel, without cookies or CSRF.

## Authentication

### 1. Sign in

```http
POST /api/auth/mobile
Content-Type: application/json

{
  "username": "admin",
  "password": "…",
  "deviceLabel": "Leopold's iPhone"   // optional
}
```

**Success (no TOTP):**

```json
{
  "accessToken": "<jwt>",
  "refreshToken": "qmr_…",
  "expiresIn": 3600,
  "tokenType": "Bearer",
  "username": "admin",
  "role": "admin",
  "domains": []
}
```

**TOTP required:**

```json
{
  "requiresTotp": true,
  "loginToken": "<short-lived challenge jwt>"
}
```

Complete with:

```http
POST /api/auth/mobile
{ "loginToken": "…", "totp": "123456", "deviceLabel": "…" }
```

### 2. Use the access token

Send on every API call:

```http
Authorization: Bearer <accessToken>
```

Bearer requests skip CSRF checks (cookie sessions still require same-origin `Origin`).

Access tokens expire in **1 hour**. Refresh before expiry.

### 3. Refresh

```http
POST /api/auth/mobile/refresh
{ "refreshToken": "qmr_…" }
```

Returns a new `accessToken` and `refreshToken` (rotation). Old refresh token is invalidated.

Refresh tokens last **90 days** and are stored server-side in `data/mobile-refresh-tokens.json`.

### 4. Log out

```http
POST /api/auth/mobile/logout
Authorization: Bearer <accessToken>
{ "refreshToken": "qmr_…" }
```

Revoke all devices:

```json
{ "allDevices": true }
```

### 5. Session check

```http
GET /api/mobile/v1/me
Authorization: Bearer <accessToken>
```

## Domain APIs (MVP)

Use existing panel routes with `Authorization: Bearer`. Same RBAC as the web UI (admin vs client domains).

| Feature | Method | Path |
|--------|--------|------|
| List domains | `GET` | `/api/domains` |
| Domain detail | `GET` | `/api/domains/{domain}` |
| DNS records | `GET` | `/api/domains/{domain}/dns` |
| Add DNS record | `POST` | `/api/domains/{domain}/dns` |
| Delete DNS record | `DELETE` | `/api/domains/{domain}/dns` |
| Mail accounts | `GET` | `/api/domains/{domain}/users` |
| Create mailbox | `POST` | `/api/domains/{domain}/users` |
| IMAP folders | `GET` | `/api/domains/{domain}/mailboxes?user=…` |
| SSL certs | `GET` | `/api/domains/{domain}/ssl` |
| Renew LE cert | `POST` | `/api/domains/{domain}/ssl` |
| Backups list | `GET` | `/api/domains/{domain}/backups` |
| Trigger backup | `POST` | `/api/domains/{domain}/backups` |
| Backup schedule | `PATCH` | `/api/domains/{domain}/backups` |

OpenAPI for mobile auth: [`docs/api/openapi-mobile.yaml`](api/openapi-mobile.yaml).

## iOS client notes

- Store `refreshToken` in Keychain; keep `accessToken` in memory.
- On `401` from domain APIs, call `/api/auth/mobile/refresh` once, then retry.
- Base URL is the operator's panel origin (e.g. `https://panel.example.com`).
- Phase C adds push, widgets, files, webmail, and Premium client-login restrictions.

## Phase C features

| Feature | App | API |
|---------|-----|-----|
| Push (APNs token register) | On login, device token → server | `POST /api/mobile/v1/push/register` |
| Home Screen widget | Domain count, SSL expiring, urgent actions | `GET /api/mobile/v1/widgets/summary` |
| Files browser | Browse `public_html`, view text, delete | `GET /api/domains/{domain}/files` |
| Webmail | INBOX, read, compose (Premium) | `/api/domains/{domain}/mailboxes/messages`, `/send` |
| Client login | Own domains only when `client-rbac` licensed | `capabilities.clientOwnDomainsOnly` in `/api/mobile/v1/me` |

### Push notifications

After sign-in the app registers its APNs device token:

```http
POST /api/mobile/v1/push/register
Authorization: Bearer <accessToken>
{ "token": "<hex>", "bundleId": "com.qadbak.panel", "deviceLabel": "iPhone" }
```

Tokens are stored in `data/mobile-push-tokens.json`. Configure Apple Push credentials on the server to deliver alerts (SSL expiry, backup stale) — delivery wiring is operator-specific.

### Widgets

The main app refreshes widget data from:

```http
GET /api/mobile/v1/widgets/summary
```

Cached in App Group `group.com.qadbak.panel` for the **Qadbak** home screen widget.

### Premium client accounts

When the server has Premium `client-rbac`, client users only see domains assigned to their account (enforced server-side). The app shows a client badge and hides admin-only flows.

## Local test

```bash
npm run test:mobile-auth
```

Requires a running panel (`npm run dev` or production) and valid credentials in `.env.local` (`QADBAK_E2E_ADMIN_USER` / `QADBAK_E2E_ADMIN_PASS` or defaults `admin` / `changeme`).

## Roadmap

| Phase | Scope |
|-------|--------|
| **A** (this) | Mobile auth + Bearer on domain APIs |
| **B** | SwiftUI MVP — see [`ios/README.md`](../ios/README.md) |
| **C** | Push, widgets, files, webmail, Premium client RBAC — see Phase C section above |
