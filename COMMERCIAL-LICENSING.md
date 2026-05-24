# Qadbak commercial licensing

Qadbak Core is published for **transparency and evaluation only**. Running it on
your own VPS for personal testing is permitted under the limited exception in
[LICENSE](LICENSE). **Commercial use requires a paid license.**

## Products

| Product | What you get |
|---------|----------------|
| **Qadbak Core** | Domain, mail, DNS, files, backups, native provisioning, basic admin |
| **Qadbak Premium** | Multi-tenant client panels, admin updates, PHP-FPM isolation, panel vhost automation, dashboard server controls |

Premium is distributed as a **signed bundle** from the license server after you
activate your key. It is **not** in the public GitHub repo, and you **do not**
need GitHub access to `qadbak-premium` or any developer Personal Access Token.

Premium modules are downloaded from the license server after activation (no separate public GitHub repo for Premium source).

## How to buy

1. Contact **info@mareades.com** or visit **https://omiiba.com** (commercial pages).
2. You receive a **license key** (and the license server URL, usually `https://license.omiiba.dev`).
3. Install public Qadbak Core on your VPS (`git clone` **macdirtycow/qadbak** only).
4. In the panel: **Server admin → License** → enter key → **Activate** → **Refresh modules**.

Premium modules download automatically from the license server to `data/premium/`.
No private repository clone is required on your server.

## License server

Licensed installations validate against:

`https://license.omiiba.dev` (configurable via `QADBAK_LICENSE_SERVER` in
`.env.local`).

Heartbeats run daily. Expired or revoked licenses disable Premium modules.

## What is not allowed without a license

- Hosting paying customers on Qadbak
- Reselling or white-labeling the panel
- Removing license checks or redistributing Premium bundles
- Forking and operating a competing hosted panel based on this code

## Legal

This document is not legal advice. For EU/NL commercial sales, consult a
qualified attorney regarding VAT, terms of service, and data processing agreements.

Copyright holders: **MacDirtyCow / Qadbak (qadbak.com)** and **Omiiba (omiiba.com,
omiiba.dev)**.
