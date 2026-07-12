# Qadbak iOS app and mobile API

The native app talks to **your** infrastructure, not a Qadbak cloud dashboard.

**App version:** 1.2.3 (TestFlight)  
**Panel mobile API:** v1 (Bearer tokens on existing `/api/*` routes)  
**Linux agent API:** v0.5.0 (`/api/v1/*` on port 9443)

## Connection modes

| Mode | When to use | Auth |
|------|-------------|------|
| **Qadbak panel** | You run the Qadbak panel on the VPS | `POST /api/auth/mobile` → Bearer JWT |
| **Linux agent** | Existing Linux box (Hestia, Coolify, CasaOS, bare metal) | SSH install + agent pairing token |

Panel path = full hosting (domains, mail, terminal). Agent path = system ops + optional read-only panel link. See [ios/EXTERNAL_SERVERS.md](ios/EXTERNAL_SERVERS.md) and [agent/PANEL-LINKING.md](agent/PANEL-LINKING.md).

---

## Panel authentication

### Sign in

```http
POST /api/auth/mobile
Content-Type: application/json

{
  "username": "admin",
  "password": "…",
  "deviceLabel": "My iPhone"
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

### Use the access token

```http
Authorization: Bearer <accessToken>
```

Bearer requests skip CSRF checks. Access tokens expire in **1 hour**.

### Refresh

```http
POST /api/auth/mobile/refresh
{ "refreshToken": "qmr_…" }
```

Returns new access + refresh (rotation). Refresh tokens last **90 days** (`data/mobile-refresh-tokens.json`).

### Log out

```http
POST /api/auth/mobile/logout
Authorization: Bearer <accessToken>
{ "refreshToken": "qmr_…" }
```

Revoke all devices: `{ "allDevices": true }`

### Session check

```http
GET /api/mobile/v1/me
Authorization: Bearer <accessToken>
```

---

## Panel domain APIs

Same routes as the web UI. RBAC applies (admin vs client domains).

| Feature | Method | Path |
|--------|--------|------|
| List domains | GET | `/api/domains` |
| Domain detail | GET | `/api/domains/{domain}` |
| DNS records | GET/POST/DELETE | `/api/domains/{domain}/dns` |
| Mail accounts | GET/POST | `/api/domains/{domain}/users` |
| IMAP folders | GET | `/api/domains/{domain}/mailboxes?user=…` |
| SSL certs | GET/POST | `/api/domains/{domain}/ssl` |
| Backups | GET/POST/PATCH | `/api/domains/{domain}/backups` |
| Download backup | GET | `/api/domains/{domain}/backups/download?name=…` |
| Files | GET/DELETE | `/api/domains/{domain}/files` |
| Webmail messages | GET/POST | `/api/domains/{domain}/mailboxes/messages`, `/send` |
| Terminal ws-token | GET/POST | `/api/domains/{domain}/terminal/ws-token` |
| Admin terminal | GET/POST | `/api/admin/terminal/ws-token` |

OpenAPI: [docs/api/openapi-mobile.yaml](api/openapi-mobile.yaml)

---

## Push, widgets, Premium client

| Feature | App behaviour | API |
|---------|---------------|-----|
| Push | Registers APNs token after login | `POST /api/mobile/v1/push/register` |
| Widget | Domain count, SSL alerts | `GET /api/mobile/v1/widgets/summary` |
| Client RBAC | Own domains only when licensed | `capabilities` in `/api/mobile/v1/me` |

Push delivery needs Apple credentials on the panel (`QADBAK_APNS_*` in `.env.local`).

### iCloud backup copies

Downloaded archives go to **Files → iCloud Drive → Qadbak Backups → {domain}/**.

Settings on the Backups screen:

- Auto-save to iCloud after “Run backup now”
- Wi-Fi only (default on)

Requires iCloud Drive and container `iCloud.com.qadbak.panel` on the provisioning profile.

---

## Linux agent (summary)

Installed from the app over SSH or manually (`agent/packaging/install.sh`).

| Feature | Agent route |
|---------|-------------|
| Overview | `GET /api/v1/system/overview` |
| Metrics history | `GET /api/v1/system/metrics?limit=60` |
| Services | `GET /api/v1/services`, POST start/stop/restart |
| Docker | `GET /api/v1/docker/containers`, logs, control |
| Logs | `GET /api/v1/logs` |
| Updates | `GET /api/v1/updates`, POST install |
| Reboot / shutdown | POST with confirm header |
| Panel link | `GET/POST/DELETE /api/v1/panels/link` |
| Panel overview | `GET /api/v1/panels/overview` |

Full reference: [agent/API.md](agent/API.md)

---

## iOS client notes

- Store `refreshToken` in Keychain; keep `accessToken` in memory
- On `401`, call `/api/auth/mobile/refresh` once, then retry
- Panel base URL = operator origin, e.g. `https://panel.example.com`
- Agent base URL = `https://host:9443` with TLS fingerprint pin from pairing
- Face ID / Touch ID optional app lock

## Local test

```bash
npm run test:mobile-auth
```

Needs a running panel and credentials (`QADBAK_E2E_ADMIN_USER` / `QADBAK_E2E_ADMIN_PASS` or defaults `admin` / `changeme`).

Build and run the app: [ios/README.md](../ios/README.md)
