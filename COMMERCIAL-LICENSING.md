# Qadbak commercial licensing

Qadbak Core is published for **transparency and evaluation only**. Running it on
your own VPS for personal testing is permitted under the limited exception in
[LICENSE](LICENSE). **Commercial use requires a paid license.**

## Products

| Product | What you get |
|---------|----------------|
| **Qadbak Core** | Domain, mail, DNS, files, backups, native provisioning, basic admin |
| **Qadbak Premium** | Multi-tenant client panels, admin updates, PHP-FPM isolation, panel vhost automation, dashboard server controls |

Qadbak is **open-core**: Premium source ships in this public repo
alongside Core. A valid license simply unlocks Premium menu items at
runtime — there is no encrypted bundle, no separate download, no
private GitHub repository.

## How to buy

1. Contact **info@mareades.com** or visit **https://omiiba.com** (commercial pages).
2. You receive a **license key** (and the license server URL, usually `https://license.omiiba.dev`).
3. Install Qadbak on your VPS (`git clone` **macdirtycow/qadbak**).
4. In the panel: **Server admin → License** → enter key → **Activate**.

Premium menu items unlock immediately on the running panel. The update
flow stays the same for Core and Premium customers:
`git pull && npm run build && pm2 restart`.

## License server

Licensed installations validate against:

`https://license.omiiba.dev` (configurable via `QADBAK_LICENSE_SERVER` in
`.env.local`).

Heartbeats run daily. Expired or revoked licenses disable Premium modules.

## What is not allowed without a license

- Hosting paying customers on Qadbak
- Reselling or white-labeling the panel
- Removing or weakening the license check in a fork distributed to others
- Forking and operating a competing hosted panel based on this code

## Legal

This document is not legal advice. For EU/NL commercial sales, consult a
qualified attorney regarding VAT, terms of service, and data processing agreements.

Copyright holders: **MacDirtyCow / Qadbak (qadbak.com)** and **Omiiba (omiiba.com,
omiiba.dev)**.
