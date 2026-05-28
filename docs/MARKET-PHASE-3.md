# Market phase 3 — Runtimes

## Delivered

- `scripts/lib/provision-runtimes.mjs` — Node (systemd + nginx proxy), Python (gunicorn template), Docker compose MVP
- Domain tab `/domains/[domain]/runtimes` + `RuntimesManager.tsx`
- API `GET/POST /api/domains/[domain]/runtimes`
- Native feature flag: `runtimes` in `QADBAK_NATIVE_FEATURES`

## Exit checklist

- [ ] PHP version per directory still via PhpManager; FPM socket shown on runtimes page
- [ ] Install Node app on test VPS; site answers on configured subpath
- [ ] `QADBAK_NATIVE_FEATURES=…,runtimes` on production
