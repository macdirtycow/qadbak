# Market phase 2 — One-click app store

## Catalog

- [data/app-catalog.json](../data/app-catalog.json) — canonical app list
- Installers: `scripts/lib/install-app-*.sh`

## Panel

Domains → **Scripts** (Apps) — install with path under `public_html`.

## Enable native scripts

```env
QADBAK_NATIVE_FEATURES=...,scripts
```
