# Qadbak Agent HTTP API (v1)

Base path: `/api/v1`  
Authenticated routes: `Authorization: Bearer <access_jwt>`  
Content-Type: `application/json`

Current agent version: **0.5.0**

## Public

### GET /health

Liveness probe (no auth).

```json
{ "ok": true, "status": "ready" }
```

### GET /version

```json
{
  "version": "0.5.0",
  "minAppVersion": "1.2.0",
  "minAgentVersion": "0.5.0"
}
```

## Pairing (unauthenticated, rate-limited)

### POST /pairing/init

Returns one-time pairing token and TLS fingerprint.

### POST /pairing/complete

Exchange one-time pairing token + device public key for tokens.

Request:

```json
{
  "pairingToken": "…",
  "deviceId": "uuid",
  "devicePublicKey": "base64",
  "deviceLabel": "iPhone"
}
```

Response:

```json
{
  "accessToken": "…",
  "refreshToken": "…",
  "expiresIn": 900,
  "tlsFingerprintSha256": "…",
  "capabilities": { … }
}
```

## Authenticated

### GET /capabilities

Authoritative feature flags for UI.

### GET /system/overview

CPU, RAM, disk, load, uptime, OS, agent version, last boot.

### GET /system/metrics

Query: `?limit=60` (default 60). Rolling CPU/memory/disk samples, recorded every 5 minutes and on overview refresh.

### GET /audit

Query: `?tail=200`. Read-only audit log (newest last).

### GET /docker/containers/{id}/logs

Query: `?tail=200`. Container stdout/stderr (sanitized).

### GET /detection/panel

Detected panel kind and confidence signals.

### GET /panels/link

Link status for the detected panel (linked or not, masked hint).

### POST /panels/link

Test credentials and save panel link. Body fields depend on panel:

- **hestiaCP:** `username` + `password`, or `accessKey` + `secretKey`, optional `baseUrl`
- **coolify:** `apiToken`, optional `baseUrl`
- **casaOS:** `apiToken`, or `username` + `password`, optional `baseUrl`

### DELETE /panels/link

Remove stored panel credentials.

### GET /panels/overview

Read-only snapshot from linked panel (users/domains/apps). Requires prior POST /panels/link.

### GET /services

List systemd units (filtered).

### POST /services/{id}/start|stop|restart

Requires capability `serviceManagement`. Destructive actions need `X-Qadbak-Confirm: <jwt>`.

### GET /docker/containers

Requires `dockerManagement`.

### POST /docker/containers/{id}/start|stop|restart

Container ID validated server-side.

### GET /docker/containers/{id}/logs

Query: `?tail=200&since=…`

### GET /logs

Query: `source=journal|service|docker`, `filter=…`, `cursor=…`

### GET /updates

Available package updates (apt).

### POST /updates/install

Controlled upgrade; requires confirmation header.

### POST /system/reboot

### POST /system/shutdown

Require confirmation JWT.

### POST /auth/rotate

Body: `{ "refreshToken": "…" }`. Returns new access + refresh tokens.

### POST /auth/revoke

Authenticated. Body: `{ "refreshToken": "…" }`. Revokes refresh token (e.g. when removing device from the app).

## Errors

```json
{ "ok": false, "error": "Human-readable message", "code": "RATE_LIMITED" }
```

| HTTP | Meaning |
|------|---------|
| 401 | Invalid or expired token |
| 403 | Capability missing |
| 409 | Confirmation required |
| 422 | Validation failed |
| 429 | Rate limited |
| 503 | Agent not ready |

## Versioning

URL prefix `/api/v1` frozen for mobile compatibility. Breaking changes → `/api/v2`.
