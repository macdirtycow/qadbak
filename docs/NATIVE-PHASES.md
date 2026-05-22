# Phase 8 sub-fases — native provisioning (zonder remote.cgi)

Elke sub-fase voegt scripts + `QADBAK_NATIVE_FEATURES` toe. Hybrid blijft VM-fallback voor functies die nog niet enabled zijn.

## Overzicht

| Fase | Feature flag | Helper commands | VPS test |
|------|--------------|-----------------|----------|
| 8a | `ssl` | ssl-list, ssl-issue | SSL-tab → Let's Encrypt |
| 8b | `dns` | dns-get, dns-add, dns-del | DNS-tab (BIND zone) |
| 8c | `domain` | domain-create, domain-delete | Nieuw domein (niet op prod zonder test) |
| 8d | `mail` | mail-* (VirtualMin **CLI**, geen API) | Mailboxen |
| 8e | `db` | db-list, db-create, db-pass | Databases |
| 8f | `backup` | backup-list, backup-create | Backups-tab |
| 8g | `cron` | cron-list, cron-create, cron-delete | Cron-tab |

## Alles inschakelen (test VPS)

```bash
cd /opt/qadbak
git pull

# In .env.local:
# QADBAK_NATIVE_FEATURES=ssl,dns,mail,db,domain,backup,cron
# QADBAK_PROVISIONER=hybrid
# QADBAK_VIRTUALMIN_FALLBACK=true   # uit zetten als alles getest is

sudo bash scripts/apply-phase8-native-enable.sh
```

## Per fase inschakelen

```bash
# Alleen SSL native:
sudo bash scripts/apply-phase8-native-phase.sh ssl

# SSL + DNS:
sudo bash scripts/apply-phase8-native-phase.sh ssl,dns
```

## Handmatige tests (siccamanagement.nl)

```bash
sudo -u qadbak sudo -n /opt/qadbak/scripts/run-provisioning-helper.sh ping
sudo -u qadbak sudo -n /opt/qadbak/scripts/run-provisioning-helper.sh ssl-list siccamanagement.nl
sudo -u qadbak sudo -n /opt/qadbak/scripts/run-provisioning-helper.sh dns-get siccamanagement.nl
```

### DNS: zone file niet gevonden?

```bash
sudo bash scripts/discover-bind-zone.sh siccamanagement.nl
sudo bash scripts/export-native-domains.sh
```

## Mail (8d) — tussenstap

`mail` gebruikt **`virtualmin` CLI** als root (geen `remote.cgi`). Dat laat toe Webmin **API** te verwijderen terwijl het `virtualmin` Debian-pakket nog geïnstalleerd is. Volledige verwijdering vereist directe Postfix/Dovecot-bestanden (toekomstig).

## Klaar voor `apt remove webmin`

1. Alle features in `QADBAK_NATIVE_FEATURES` getest op testdomein.
2. `QADBAK_VIRTUALMIN_FALLBACK=false`
3. `QADBAK_PROVISIONER=native`
4. Preflight + E2E groen.
5. Backup → packages verwijderen.

Zie [VM-REMOVAL-ROADMAP.md](./VM-REMOVAL-ROADMAP.md).
