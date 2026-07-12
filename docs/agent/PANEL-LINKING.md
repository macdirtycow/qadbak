# Panel linking (Linux agent)

Agent **v0.6.0+** connects to open-source panels on the same server. The iOS app uses the agent for **full hosting operations** (HestiaCP) or **app management** (Coolify).

## Supported panels

| Panel | Credentials | App features after linking |
|-------|-------------|----------------------------|
| **HestiaCP** | Admin username + password, or access key + secret | Domains tab: list/create domains, DNS, mail, aliases, databases, SSL |
| **Coolify** | API token (Settings → Keys & Tokens) | Apps tab: list apps, deploy / start / stop |
| **CasaOS** | API token, or username + password | Apps tab: list installed apps (read-only) |

Credentials are stored in `/var/lib/qadbak-agent/panel-link.json` (mode `0600`) on the server. The iOS app only holds the agent JWT.

Plesk and DirectAdmin are **detected** but not linkable yet.

## Capabilities

After linking, `/api/v1/capabilities` includes:

- `domainHosting: true` — linked HestiaCP
- `panelApps: true` — linked Coolify or CasaOS

The iOS app opens a tab shell: **Domains**, **Apps**, and **Server** (metrics, Docker, services).

## API (agent)

All routes require `Authorization: Bearer <agent-access-token>`.

### Linking

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/panels/link` | Link status for detected panel |
| `POST` | `/api/v1/panels/link` | Test credentials and save link (returns updated `capabilities`) |
| `DELETE` | `/api/v1/panels/link` | Remove stored credentials |
| `GET` | `/api/v1/panels/overview` | Snapshot from linked panel |

### HestiaCP hosting (requires Hestia link)

| Method | Path | Description |
|--------|------|-------------|
| `GET` / `POST` | `/api/v1/panels/domains` | List / create domains (`panel.domain.create` confirm) |
| `DELETE` | `/api/v1/panels/domains/{domain}` | Delete domain (`panel.domain.delete` confirm) |
| `GET` / `POST` / `DELETE` | `…/domains/{domain}/dns` | DNS records |
| `GET` / `POST` / `DELETE` | `…/domains/{domain}/mail` | Mail accounts |
| `GET` / `POST` / `DELETE` | `…/domains/{domain}/aliases` | Mail forwards |
| `GET` / `POST` | `…/domains/{domain}/databases` | MySQL databases |
| `GET` / `POST` | `…/domains/{domain}/ssl` | List / issue Let's Encrypt |

### Coolify apps (requires Coolify link)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/panels/apps` | List applications |
| `POST` | `/api/v1/panels/apps/{id}/{action}` | `deploy`, `start`, or `stop` (`panel.app.*` confirm) |

Destructive actions use the existing confirm JWT flow (`POST /api/v1/actions/confirm` → `X-Qadbak-Confirm` header).

### POST link body examples

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

1. **Servers → Add server → Linux server via SSH** (installs agent **0.6.0+**).
2. Open the server dashboard — panel badge appears if Hestia/Coolify/CasaOS is detected.
3. Tap **Link HestiaCP** (or Coolify / CasaOS), enter API credentials.
4. App unlocks **Domains** and/or **Apps** tabs alongside **Server**.

System operations (metrics, Docker, reboot) work without linking the panel.

## Scope and limits

- One panel link at a time (Hestia **or** Coolify **or** CasaOS).
- Hestia path covers core hosting (no FTP, cron, files, or Qmail in the app yet).
- Agent calls the panel API on **localhost**; your phone talks only to the agent on port **9443**.
- Requires agent **0.6.0+** (upgrade from the app or reinstall).

See also [EXTERNAL_SERVERS.md](../ios/EXTERNAL_SERVERS.md) and [SUPPORTED_SYSTEMS.md](./SUPPORTED_SYSTEMS.md).
