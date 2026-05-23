# Fase 8 — Onafhankelijk (geen VirtualMin API)

Twee modi binnen fase 8:

| Modus | `QADBAK_PROVISIONER` | `QADBAK_VIRTUALMIN_FALLBACK` | Gebruik |
|-------|----------------------|------------------------------|---------|
| **Hybrid** (veilig) | `hybrid` | `true` | Native voor ssl/dns/mail/…; rest via `remote.cgi` |
| **Onafhankelijk** | `native` | `false` | Alleen native + registry; geen `remote.cgi` |

Webmin UI uit (`QADBAK_DISABLE_WEBMIN=true`) in beide modi. Panel-nginx bevat **geen** `/embed/webmin/` (optioneel via `deploy/nginx-webmin-embed-snippet.conf`).

## Wat onafhankelijk wél is

- Domeinlijst: `data/native-domains.json`
- Hosting: SSL, DNS, mail, DB, backup, cron, aliases, redirects, features, logs, php, ftp, limits, lifecycle, mail-settings, mail-logs, imap, protected, shared, proxies, scripts, security, resellers (`provisioning-helper`)
- Files, terminal, website repair, stack, host metrics (eigen helpers)
- **Admin → Services:** systemctl start/stop/restart via `host-services-helper`
- **Admin → disk/bandwidth:** `du` per domain home (geen VirtualMin `list-bandwidth`)
- **Backups:** full archive in `~/backups` (public_html, Maildir, MySQL dumps, Qadbak config), restore, cron schedule (`scripts/run-domain-backup.sh`)
- **Lifecycle:** clone (rsync), transfer (panel user), migrate (backup + stappen)
- **Admin:** license, templates, admins, global features, check-config, S3 (AWS CLI), vm-status (native probe)
- Niet-native acties **falen met duidelijke fout** (geen stille VM-call)

## Audit op de server

```bash
bash scripts/audit-vm-dependency.sh
```

## Veilige volgorde (test-VPS)

```bash
cd /opt/qadbak
git pull

sudo bash scripts/apply-phase8-native-enable.sh   # hybrid + alle flags
# Panel testen: DNS, SSL, mail, DB, lifecycle clone, admin templates

sudo bash scripts/preflight-phase8-independent.sh
sudo bash scripts/apply-phase8-independent.sh
sudo bash scripts/fix-panel-nginx-port.sh
sudo bash scripts/pm2-restart-qadbak.sh

curl -s http://127.0.0.1:3000/api/health
# verwacht: "provisioner":"native", "virtualminFallback":false
```

## Webmin/VirtualMin pakketten verwijderen

Pas na panel-tests + backup:

```bash
sudo bash scripts/uninstall-virtualmin.sh --dry-run
sudo bash scripts/uninstall-virtualmin.sh
```

Zie [VM-REMOVAL-ROADMAP.md](./VM-REMOVAL-ROADMAP.md).

## Terugdraaien

```bash
# .env.local:
# QADBAK_PROVISIONER=hybrid
# QADBAK_VIRTUALMIN_FALLBACK=true

sudo -u qadbak bash -c 'cd /opt/qadbak && bash scripts/pm2-restart-qadbak.sh'
```

## Verder lezen

- [PHASE-8-NATIVE.md](./PHASE-8-NATIVE.md)
- [QADBAK-INDEPENDENCE-8-PHASES.md](./QADBAK-INDEPENDENCE-8-PHASES.md)
- [VIRTUALMIN-EMBEDS.md](./VIRTUALMIN-EMBEDS.md) (alleen hybrid + break-glass)
