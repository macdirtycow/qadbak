# Qadbak Commercial — Premium Features

The Qadbak panel is licensed for **panel use only** (see [LICENSE](LICENSE)).
You may install and run it on servers you control to manage hosting. You may
**not** redistribute, mirror, or republish the software as your own product.

## Panel license (included)

Installing from the official repository grants the right to run the panel on
your infrastructure. The software is not Apache 2.0 open source and may not
be copied or offered as a competing control-panel product.

## Premium add-on (paid)

Advanced modules require a paid license key from `license.inveil.dev`:

- Multi-tenant client management (clients table, panel-vhost provisioning)
- Per-user PHP-FPM isolation
- Live admin updates (Qadbak version upgrades from the panel)
- Ubuntu LTS release upgrade (22.04→24.04, 24.04→26.04) from Admin → Updates
- Advanced RBAC
- Reseller plans
- Qmail / webmail UI
- Offsite backups, white-label, and related Premium modules

Buy a license at https://qadbak.com#premium. The key is verified at runtime
via a periodic heartbeat to `license.inveil.dev`.

Without a key, Premium features are visible in the UI but disabled. Bypassing
license checks in production violates the [LICENSE](LICENSE) and
[Terms of Service](https://qadbak.com/terms).

## Support

Questions: info@inveil.net · Legal: legal@inveil.net
