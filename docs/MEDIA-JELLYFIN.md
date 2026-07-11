# Media — Jellyfin, library folder, and HTML5 player

Qadbak ships three complementary media features per domain.

## 1. Jellyfin (one-click app)

**Install:** Server admin → App store → **Jellyfin**, or Domains → [domain] → Apps.

- Provisions Docker (if needed) and a `media.{domain}` subdomain with nginx + WebSocket proxy
- Let's Encrypt on the media host when certbot is available
- Full Jellyfin UI for libraries, users, and clients

See `scripts/lib/provision-jellyfin.mjs`.

## 2. Media library (panel)

**Route:** Domains → [domain] → **Media**

- Set the folder path for movies/series (under the domain user's home)
- View disk usage and Jellyfin status/link when installed
- Upload and organize files via the file manager

API: `/api/domains/[domain]/media`

## 3. HTML5 quick player

Same **Media** tab — play **MP4/WebM** files in the browser without Jellyfin.

- Lists videos in the configured media folder
- Range requests for seeking (`/api/domains/[domain]/media/stream`)

Useful for quick previews or lightweight streaming; Jellyfin remains the full-featured option.

## Requirements

- **Native stack** VPS with Docker for Jellyfin one-click
- Sufficient disk for media libraries
- For panel-only installs: media library UI works; Jellyfin install needs a host with Docker and nginx

## Related

- [LINUX-SUPPORT.md](./LINUX-SUPPORT.md) — supported OS for native stack
- [MARKET-FEATURES.md](./MARKET-FEATURES.md) — operator feature overview
