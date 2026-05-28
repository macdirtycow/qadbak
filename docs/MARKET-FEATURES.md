# Market competition features (phases 1–8)

Shipped on `main` for native VPS installs. Each phase has a checklist in `docs/MARKET-PHASE-N.md`.

## Overview

| Phase | Summary | Doc | Panel |
|-------|---------|-----|-------|
| **1** | Native production hardening, E2E matrix | [MARKET-PHASE-1.md](./MARKET-PHASE-1.md) | Health, Status, Domains |
| **2** | One-click app catalog | [MARKET-PHASE-2.md](./MARKET-PHASE-2.md) | App catalog, Domain → Apps |
| **3** | Node, Python, Docker runtimes | [MARKET-PHASE-3.md](./MARKET-PHASE-3.md) | Domain → Runtimes, PHP |
| **4** | Encrypted offsite backups | [MARKET-PHASE-4.md](./MARKET-PHASE-4.md) | Cloud, Backups offsite |
| **5** | Granular backup restore | [MARKET-PHASE-5.md](./MARKET-PHASE-5.md) | Backups archive wizard |
| **6** | Metrics + alerts | [MARKET-PHASE-6.md](./MARKET-PHASE-6.md) | Status, metrics 24h/7d/30d |
| **7** | Firewall, WAF, ClamAV | [MARKET-PHASE-7.md](./MARKET-PHASE-7.md) | Firewall, Domain security |
| **8** | REST API v1, integrations | [MARKET-PHASE-8.md](./MARKET-PHASE-8.md) | API keys, OpenAPI |

The phase roadmap is **not** shown in the customer-facing panel (internal/docs and `scripts/run-market-phases-check.sh` only).

## Quick verify on a VPS

```bash
cd /opt/qadbak
sudo bash scripts/run-market-phases-check.sh   # all 8 phases
sudo bash scripts/run-market-phase1-check.sh   # phase 1 only
```

## Operator highlights

- **Panel URLs:** `https://panel.<customer-domain>/login` — [CLOUDFLARE.md](./CLOUDFLARE.md)
- **After update:** `sudo bash scripts/fix-panel-now.sh`
- **API:** [api/openapi.yaml](./api/openapi.yaml) · [WHMCS](./integrations/WHMCS-INTEGRATION.md)
