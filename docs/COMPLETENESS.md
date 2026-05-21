# Completeness checklist

What is **done** in the repo vs what you still do on a **test VPS**.

## Done in repository (v1)

| Area | Status |
|------|--------|
| VirtualMin hosting UI (domains, mail, DNS, SSL, …) | Code complete |
| Admin + client RBAC | Done |
| Webmin embed menus (v2–v5 interim) | Done |
| Marketing site + name story | Done |
| Installer: Node, npm, pm2, VirtualMin, Qadbak, nginx | Done |
| Front door (IP/443 → Qadbak) | nginx template + installer |
| Docs: test server, E2E, deploy, about the name | Done |
| Health API `/api/health` | Done |
| Scripts: `preflight`, `post-install-verify`, `update-qadbak`, `configure-ufw-qadbak` | Done |
| **Playwright E2E on install** | Built into `post-install-verify.sh` (real panel) |
| **Playwright E2E (mock, dev)** | `npm run test:e2e` — [E2E-PLAYWRIGHT.md](./E2E-PLAYWRIGHT.md) |

## You still do once (test VPS)

| Step | Command / doc |
|------|----------------|
| Rent Ubuntu 22.04 VPS | — |
| DNS → panel hostname | — |
| Install | `sudo bash install/qadbak-install.sh` |
| Verify | `sudo bash scripts/post-install-verify.sh` |
| Optional firewall | `sudo bash scripts/configure-ufw-qadbak.sh` |
| Create test domain in VirtualMin | Webmin or after first login |
| E2E sign-off | [E2E-CHECKLIST.md](./E2E-CHECKLIST.md) |

## Not in scope for v1 (later)

| Item | Notes |
|------|--------|
| Native UI for every Webmin module | Embed strategy until rebuilt |
| Lock Webmin to localhost only | Optional hardening doc in FRONT-DOOR.md |
| Production on mareades | Use isolated test VPS first |
| Automated CI on GitHub | Future |
| Multi-server VirtualMin cluster | Gap in parity audit |

## After v1 passes

1. Point production panel hostname (e.g. qadbak.com) at a **new** deploy or migrated host.
2. `bash scripts/update-qadbak.sh` for routine updates.
3. Continue v2 native modules per [ROADMAP.md](./ROADMAP.md).
