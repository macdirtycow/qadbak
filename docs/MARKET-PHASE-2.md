# Market phase 2 — One-click app store

## Catalog

- [data/app-catalog.json](../data/app-catalog.json) — canonical app list (categories, icons, coming-soon flags)
- Installers: `scripts/lib/install-app-*.sh`
- Intent templates: `src/lib/apps/templates/` + `from-catalog.ts` (auto from catalog)

## Panel

| Surface | Use |
|---------|-----|
| **Server admin → App catalog** | One-click install: DB + files + journal + credentials |
| **Domains → Apps** | Install into a custom subfolder; rollback snapshots |

## Apps (intent install)

WordPress (full wp-config), Joomla, Drupal, Nextcloud, phpMyAdmin, Matomo.

## Enable native scripts

```env
QADBAK_NATIVE_FEATURES=...,scripts
```

## Panel (fase 2)

| Flow | Path |
|------|------|
| Catalog + search | Admin → **App catalog** |
| One-click + DB + journal | App catalog → choose app → Install |
| Custom subpath + rollback | Domains → [domain] → **Apps** |

**Catalog file:** `data/app-catalog.json` (icons, categories, coming-soon flags).
