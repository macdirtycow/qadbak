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
| 8h | `aliases` | alias-list, alias-create, alias-delete | Email aliases + Postfix map |
| 8i | `redirects` | redirect-* + `apply-domain-nginx.sh` | URL redirects in nginx |
| 8j | `features` | feature-list, feature-set | Features-tab (local JSON) |
| 8k | `logs` | logs-tail | Website logs (tail files) |
| 8l | `php` | php-versions, php-directories, php-ini, php-set-directory | PHP-tab (versies uit `/etc/php`) |
| 8m | `imap` | imap-list, imap-copy, imap-messages, imap-fetch | IMAP folders + read mail via **Dovecot** / Maildir |
| 8n | `ftp` | ftp-list, ftp-create, ftp-delete, ftp-pass | FTP-accounts (unix users onder domein) |
| 8o | `limits` | limits-get, limits-set | Limieten (JSON + registry) |
| 8p | `lifecycle` | domain-enable, domain-disable, domain-validate | Domein aan/uit + validatie |
| 8q | `mail-settings` | mail-settings-get, mail-settings-set | Mail-instellingen (JSON) |
| 8r | `mail-logs` | mail-logs-search | Postfix/Dovecot mail.log grep |
| 8s | `protected` | protected-* | HTTP basic auth dirs (JSON + .htaccess) |
| 8t | `shared` | shared-* | Shared addresses (JSON) |
| 8u | `proxies` | proxy-list, proxy-create, proxy-delete | Reverse proxy paths in nginx |
| 8v | `scripts` | script-available, script-list, script-install, script-delete | WordPress / phpMyAdmin / Nextcloud ZIP |
| 8w | `security` | security-get, security-spam, security-dkim | SpamAssassin + OpenDKIM per domain |
| 8x | `resellers` | reseller-*, plan-* | Plans/resellers JSON (`data/native-plans-resellers.json`) |

## Alles inschakelen (test VPS)

```bash
cd /opt/qadbak
git pull

sudo bash scripts/apply-phase8-native-enable.sh
# Of v1 panel compleet (zonder domain create):
sudo bash scripts/apply-phase8-native-v1-panel.sh
# Zet QADBAK_NATIVE_FEATURES=ssl,dns,mail,db,domain,backup,cron, rebuild + smoke tests
```

**Alleen ssl+dns al actief?** Voeg de rest toe:

```bash
sudo bash scripts/apply-phase8-native-phase.sh ssl,dns,mail,db,backup,cron
# domain alleen op lege test-VPS (create/delete)
```

## Per fase inschakelen

```bash
# Alleen SSL native:
sudo bash scripts/apply-phase8-native-phase.sh ssl

# SSL + DNS:
sudo bash scripts/apply-phase8-native-phase.sh ssl,dns
```

## Handmatige tests (example.com)

```bash
sudo -u qadbak sudo -n /opt/qadbak/scripts/run-provisioning-helper.sh ping
sudo -u qadbak sudo -n /opt/qadbak/scripts/run-provisioning-helper.sh ssl-list example.com
sudo -u qadbak sudo -n /opt/qadbak/scripts/run-provisioning-helper.sh dns-get example.com
```

### DNS: zone file niet gevonden?

```bash
sudo bash scripts/discover-bind-zone.sh example.com
sudo bash scripts/export-native-domains.sh
```

## Mail (8d) — Postfix/Dovecot direct

`mail` gebruikt **Qadbak Postfix maps** (`qadbak-domains`, `qadbak-vmailbox`, …) + **Maildir** onder `/home/<owner>/` en optioneel `/home/<owner>/homes/<user>/`.

| Env | Gedrag |
|-----|--------|
| `QADBAK_MAIL_BACKEND=direct` | Geen `virtualmin` CLI (standaard bij `native` / fallback uit) |
| `QADBAK_MAIL_BACKEND=virtualmin` | Oude CLI (alleen hybrid + fallback) |

Debug: `sudo bash scripts/discover-mail-layout.sh example.com`

## Klaar voor `apt remove webmin`

1. Alle features in `QADBAK_NATIVE_FEATURES` getest op testdomein.
2. `QADBAK_VIRTUALMIN_FALLBACK=false`
3. `QADBAK_PROVISIONER=native`
4. Preflight + E2E groen.
5. Backup → packages verwijderen.

Zie [VM-REMOVAL-ROADMAP.md](./VM-REMOVAL-ROADMAP.md).
