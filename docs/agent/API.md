# Qadbak Agent — HTTP API (v1)

Base path: `/api/v1`  
All authenticated routes: `Authorization: Bearer <access_jwt>`  
Content-Type: `application/json`

## Public

### GET /health

Liveness probe (no auth).

```json
{ "ok": true, "status": "ready" }
```

### GET /version

```json
{
  "version": "0.3.0",
  "minAppVersion": "1.2.0",
  "minAgentVersion": "0.3.0"
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

Time-series snapshot or current gauges (implementation phase 3).

### GET /system/metrics

Query: `?limit=60` — rolling CPU/memory/disk samples (recorded every 5 minutes and on overview refresh).

### GET /audit

Query: `?tail=200` — read-only audit log entries (newest last in response).

### GET /docker/containers/{id}/logs

Query: `?tail=200` — container stdout/stderr (sanitized).

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

Body: `{ "refreshToken": "…" }` — returns new access + refresh.

### POST /auth/revoke

Authenticated. Body: `{ "refreshToken": "…" }` — revokes refresh token (e.g. when removing device).

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
