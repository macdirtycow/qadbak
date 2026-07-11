# Qadbak Commercial — Premium Features

The Qadbak core panel is open source under the Apache 2.0 License (see
[LICENSE](LICENSE)). You can install, self-host, modify, and use it commercially
without paying anything.

## Premium add-on (paid)

Some advanced modules are gated by a paid license key issued by
`license.omiiba.dev`. These include:

- Multi-tenant client management (clients table, panel-vhost provisioning)
- Per-user PHP-FPM isolation
- Live admin updates (Qadbak version upgrades from the panel)
- Ubuntu LTS release upgrade (22.04→24.04, 24.04→26.04) from Admin → Updates
- Advanced RBAC
- Reseller plans

Buy a license at https://qadbak.com#premium. The key is verified at
runtime via a periodic heartbeat to `license.omiiba.dev`.

Without a key, Premium features are visible in the UI but disabled.
You can fork the code under the Apache 2.0 License and remove the gate
yourself, but you'd be giving up automatic security updates, premium
support, and the goodwill of the project.

## Support

Questions: info@omiiba.dev
