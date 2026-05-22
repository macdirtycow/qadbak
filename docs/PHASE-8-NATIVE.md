# Phase 8 — Zonder Webmin/VirtualMin in het panel (hybrid start)

**Doel:** Klanten en admins gebruiken alleen Qadbak; geen `:10000`, geen Webmin-tabs. VirtualMin mag tijdelijk op de server blijven voor mail/DNS API’s tot die native zijn.

## Modi

| `QADBAK_PROVISIONER` | Betekenis |
|----------------------|-----------|
| `virtualmin` | Alles via `remote.cgi` (klassiek) |
| `hybrid` | Domeinlijst uit `data/native-domains.json`; overige acties nog VM API |
| `native` | Zelfde als hybrid zonder VM-fallback (alleen waar native klaar is) |

| Env | Effect |
|-----|--------|
| `QADBAK_DISABLE_WEBMIN=true` | Geen embed, geen Webmin-tab, geen login-links |
| `QADBAK_VIRTUALMIN_FALLBACK=true` | Mail/DNS/… blijven `remote.cgi` aanroepen |
| `QADBAK_NATIVE_INSTALL=1` | `install-hosting-stack.sh` slaat Webmin over |

## Test VPS (`vmi3317912`)

```bash
cd /opt/qadbak
git pull

# Eén regel in .env.local (panel admin wachtwoord voor E2E):
# QADBAK_E2E_ADMIN_PASS=jouw-wachtwoord

sudo bash scripts/apply-phase8-test-server.sh
```

Controle:

- `curl -s http://127.0.0.1:3000/api/health` → `"provisioner":"hybrid"`
- Panel → **Domains** toont `siccamanagement.nl` zonder Webmin
- Geen **Webmin**-tab op domein

## Domeinregistry bijwerken

Na nieuw domein (nog via VM CLI of toekomstig native create):

```bash
sudo bash scripts/export-native-domains.sh
sudo -u qadbak pm2 restart qadbak
```

## E2E

```bash
# Zet wachtwoord in .env.local:
QADBAK_E2E_ADMIN_PASS=...

sudo bash scripts/sync-e2e-credentials.sh
sudo bash scripts/run-install-e2e.sh
```

## Volledig VirtualMin verwijderen

Pas wanneer mail/DNS/SSL/create-domain native zijn:

1. `QADBAK_VIRTUALMIN_FALLBACK=false`
2. `QADBAK_PROVISIONER=native`
3. `apt remove webmin virtualmin-*` (eigen risico — backup eerst)

Zie [QADBAK-INDEPENDENCE-8-PHASES.md](./QADBAK-INDEPENDENCE-8-PHASES.md).
