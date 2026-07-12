# Panel linking (Linux agent)

Agent **v0.5.0+** can connect to open-source panels on the same server and return **read-only** summaries to the iOS app.

## Supported panels

| Panel | Credentials | What you see in the app |
|-------|-------------|-------------------------|
| **HestiaCP** | Admin username + password, or access key + secret | Panel version, user count, domain count |
| **Coolify** | API token (Settings → Keys & Tokens) | Project count, application list |
| **CasaOS** | API token, or username + password | Installed apps, version |

Credentials are stored in `/var/lib/qadbak-agent/panel-link.json` (mode `0600`) on the server. The iOS app only holds the agent JWT.

Plesk and DirectAdmin are **detected** but not linkable yet.

## API (agent)

All routes require `Authorization: Bearer <agent-access-token>`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/panels/link` | Link status for detected panel |
| `POST` | `/api/v1/panels/link` | Test credentials and save link |
| `DELETE` | `/api/v1/panels/link` | Remove stored credentials |
| `GET` | `/api/v1/panels/overview` | Read-only snapshot from linked panel |

### POST body examples

**HestiaCP (password):**
```json
{
  "panel": "hestiaCP",
  "baseUrl": "https://127.0.0.1:8083",
  "username": "admin",
  "password": "…"
}
```

**Coolify:**
```json
{
  "panel": "coolify",
  "baseUrl": "http://127.0.0.1:8000",
  "apiToken": "…"
}
```

**CasaOS:**
```json
{
  "panel": "casaOS",
  "username": "…",
  "password": "…"
}
```

Default `baseUrl` values target localhost on the agent host.

## iOS flow

1. **Servers → Add server → Linux server via SSH** (installs agent).
2. Open the server dashboard — panel badge appears if Hestia/Coolify/CasaOS is detected.
3. Tap **Link HestiaCP** (or Coolify / CasaOS), enter API credentials.
4. Overview refreshes with users, domains, or apps.

System operations (metrics, Docker, reboot) work without linking the panel.

## Scope and limits

- **Read-only.** No domain create/delete through the agent yet.
- Agent calls the panel API on **localhost**; your phone talks only to the agent on port **9443**.
- Requires agent **0.5.0+** (reinstall or upgrade from the app after rebuilding binaries).

See also [EXTERNAL_SERVERS.md](../ios/EXTERNAL_SERVERS.md) and [SUPPORTED_SYSTEMS.md](./SUPPORTED_SYSTEMS.md).
