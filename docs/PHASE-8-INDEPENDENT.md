# Fase 8 — Onafhankelijk (geen VirtualMin API)

Twee modi binnen fase 8:

| Modus | `QADBAK_PROVISIONER` | `QADBAK_VIRTUALMIN_FALLBACK` | Gebruik |
|-------|----------------------|------------------------------|---------|
| **Hybrid** (veilig) | `hybrid` | `true` | Native voor ssl/dns/mail/…; rest via `remote.cgi` |
| **Onafhankelijk** | `native` | `false` | Alleen native + registry; geen `remote.cgi` |

Webmin UI blijft uit (`QADBAK_DISABLE_WEBMIN=true`) in beide modi.

## Wat “onafhankelijk” wél is

- Domeinlijst uit `data/native-domains.json`
- SSL, DNS, mail, DB, backup, cron via `provisioning-helper` (geen API)
- Files, terminal, website repair via eigen sudo-helpers
- Niet-native panel-acties **falen met duidelijke fout** (geen stille VM-call)

## Wat nog níet onafhankelijk is

- **`virtualmin` Debian-pakket** — mail-native gebruikt `virtualmin list-users` CLI
- **FTP, PHP, aliases, redirects, proxies, scripts, limits, …** — nog geen native module
- **`apt remove webmin`** — pas na pure Postfix/Dovecot-scripts en volledige parity-test

## Veilige volgorde (test-VPS)

```bash
cd /opt/qadbak
git pull

# 1. Hybrid + alle native modules (al gedaan als smoke tests groen zijn)
sudo bash scripts/apply-phase8-native-enable.sh

# 2. Panel handmatig testen: DNS, SSL, DB, mail, backup, cron

# 3. Onafhankelijk zetten (geen remote.cgi meer)
sudo bash scripts/preflight-phase8-independent.sh
sudo bash scripts/apply-phase8-independent.sh

curl -s http://127.0.0.1:3000/api/health
# verwacht: "provisioner":"native"
```

## Terugdraaien

```bash
# In .env.local:
# QADBAK_PROVISIONER=hybrid
# QADBAK_VIRTUALMIN_FALLBACK=true

sudo -u qadbak bash -c 'cd /opt/qadbak && bash scripts/pm2-restart-qadbak.sh'
```

## 8-fasenplan

Zie [QADBAK-INDEPENDENCE-8-PHASES.md](./QADBAK-INDEPENDENCE-8-PHASES.md) — fase 8 exit = control plane is Qadbak; **onafhankelijk** = geen API-fallback; **pakketten weg** = latere sub-stap.
