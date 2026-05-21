# Parity audit — Webmin / Virtualmin vs Qadbak

Reference server: **mareades.com** (Ubuntu 22.04, Webmin 2.641, Virtualmin 8.1.0 GPL).

**Status legend**

| Status | Meaning |
|--------|---------|
| **UI** | Native panel screen + API |
| **API** | API wired; UI incomplete |
| **Embed** | In-panel Webmin/Usermin module (login link iframe) — interim for v2–v5 |
| **Link** | External one-shot login link only |
| **Gap** | Not implemented |
| **N/A** | Module unused on server |

**Phase target:** v1 = Virtualmin hosting native · v2 = Dashboard+System · v3 = Servers · v4–v5 = Tools/Net/HW/Cluster

---

## Virtualmin sidebar (v1 — must be UI)

| Menu item | Route / program | Status | Phase |
|-----------|-----------------|--------|-------|
| Virtual Server Summary | `/domains/[domain]` | UI | v1 |
| Create Sub-Server | `/domains/new?type=sub` | UI | v1 |
| Create Alias Server | `/domains/new?type=alias` | UI | v1 |
| Edit Virtual Server | `/domains/[domain]`, features, limits | UI | v1 |
| Edit Users | `/domains/[domain]/email` | UI | v1 |
| Edit Databases | `/domains/[domain]/databases` | UI | v1 |
| Manage Web Apps | `/domains/[domain]/scripts` | UI | v1 |
| File Manager | `/domains/[domain]/files` | UI+Embed live | v1 |
| Terminal | `/domains/[domain]/terminal` | Embed (UI) | v1 |
| Manage Virtual Server | features, limits, lifecycle | UI | v1 |
| DNS Settings | `/domains/[domain]/dns` | UI | v1 |
| Web Configuration | redirects, proxies, php, protected | UI | v1 |
| Mail Options | email, aliases, mail-settings | UI | v1 |
| Logs and Reports | logs, mail-logs | UI | v1 |
| Disable and Delete | `/domains/[domain]/lifecycle` | UI | v1 |
| System Settings | `/admin/system` | UI | v1 |
| System Customization | `/admin/system` (templates) | API | v1 |
| Addresses and Networking | `/admin/system` | Gap | v2 |
| Email Settings | `/admin/system` | Partial | v2 |
| Limits and Validation | `/domains/[domain]/limits` | UI | v1 |
| Add Servers | — | Gap | v5 |

---

## Webmin — Dashboard (v2)

| Item | Target | Status | Phase |
|------|--------|--------|-------|
| System Information table | `/admin/status` | Embed+UI | v2 |
| CPU / memory / disk gauges | `/admin/status` | UI | v2 |
| Package updates | `/admin/status` | Embed | v2 |
| Reboot warning / action | `/admin/status` | Embed | v2 |
| Stats history graphs | `/admin/status` | Gap | v2.1 |

---

## Webmin — category Webmin (v2)

| Item | Module path | Status | Phase |
|------|-------------|--------|-------|
| Backup Configuration Files | `/backup-config/` | Embed | v2 |
| Change Language and Theme | `/settings/` | Embed | v2 |
| Usermin Configuration | `/usermin/` | Embed | v2 |
| Webmin Actions Log | `/webminlog/` | Embed | v2 |
| Webmin Configuration | `/config/` | Embed | v2 |
| Webmin Servers Index | `/servers/` | Embed | v2 |
| Webmin Users | `/webminusers/` | Embed | v2 |

---

## Webmin — System (v2)

| Item | Module path | Status | Phase |
|------|-------------|--------|-------|
| Bootup and Shutdown | `/init/` | Embed | v2 |
| Change Passwords | `/passwd/` | Embed | v2 |
| Disk and Network Filesystems | `/mount/` | Embed | v2 |
| Disk Quotas | `/quota/` | Embed | v2 |
| Filesystem Backup | `/fsdump/` | Embed | v2 |
| Jailkit Jail Manager | `/jailkit/` | Embed | v2 |
| Log File Rotation | `/logrotate/` | Embed | v2 |
| MIME Type Programs | `/mime/` | Embed | v2 |
| PAM Authentication | `/pam/` | Embed | v2 |
| Running Processes | `/proc/` | Embed | v2 |
| Scheduled Cron Jobs | `/cron/` | Embed | v2 |
| Software Package Updates | `/package-updates/` | Embed | v2 |
| Software Packages | `/software/` | Embed | v2 |
| System Documentation | `/man/` | Embed | v2 |
| System Logs | `/logviewer/` | Embed | v2 |
| System Logs RS | `/logviewer/` | Embed | v2 |
| Users and Groups | `/useradmin/` | Embed | v2 |

---

## Webmin — Servers (v3)

| Item | Module path | Status | Phase |
|------|-------------|--------|-------|
| Apache Webserver | `/apache/` | Embed | v3 |
| AWStats Reporting | `/awstats/` | Embed | v3 |
| BIND DNS Server | `/bind8/` | Embed | v3 |
| Dovecot IMAP/POP3 Server | `/dovecot/` | Embed | v3 |
| MariaDB Database Server | `/mysql/` | Embed | v3 |
| Nginx Webserver | `/nginx/` | Embed | v3 |
| Postfix Mail Server | `/postfix/` | Embed | v3 |
| Procmail Mail Filter | `/procmail/` | Embed | v3 |
| ProFTPD Server | `/proftpd/` | Embed | v3 |
| Read User Mail | `/mailboxes/` | Embed | v3 |
| SpamAssassin Mail Filter | `/spam/` | Embed | v3 |
| SSH Server | `/sshd/` | Embed | v3 |

---

## Webmin — Tools (v4)

| Item | Module path | Status | Phase |
|------|-------------|--------|-------|
| Command Shell | `/shell/` | Embed | v4 |
| Custom Commands | `/custom/` | Embed | v4 |
| File Manager | `/filemin/` | Embed | v4 |
| HTTP Tunnel | `/tunnel/` | Embed | v4 |
| Perl Modules | `/cpan/` | Embed | v4 |
| PHP Configuration | `/phpini/` | Embed | v4 |
| Protected Web Directories | `/htaccess-htpasswd/` | Embed | v4 |
| Ruby GEMS | `/ruby/` | Embed | v4 |
| System and Server Status | `/status/` | Embed | v4 |
| Terminal | `/xterm/` | Embed | v4 |
| Upload and Download | `/upload/` | Embed | v4 |

---

## Webmin — Networking (v4)

| Item | Module path | Status | Phase |
|------|-------------|--------|-------|
| Bandwidth Monitoring | `/bandwidth/` | UI partial + Embed | v4 |
| Fail2Ban Intrusion Detector | `/fail2ban/` | Embed | v4 |
| FirewallD | `/firewalld/` | Embed | v4 |
| Linux Firewall | `/firewall/` | Embed | v4 |
| Network Configuration | `/net/` | Embed | v4 |
| NIS Client and Server | `/nis/` | Embed | v4 |
| TCP Wrappers | `/tcpwrappers/` | Embed | v4 |

---

## Webmin — Hardware (v4)

| Item | Module path | Status | Phase |
|------|-------------|--------|-------|
| iSCSI Client | `/iscsi/` | Embed | v4 |
| Linux RAID | `/raid/` | Embed | v4 |
| Logical Volume Management | `/lvm/` | Embed | v4 |
| Partitions on Local Disks | `/fdisk/` | Embed | v4 |
| Printer Administration | `/lpadmin/` | Embed | v4 |
| System Time | `/time/` | Embed | v4 |

---

## Webmin — Cluster (v5)

| Item | Module path | Status | Phase |
|------|-------------|--------|-------|
| Cluster Change Passwords | `/cluster-passwd/` | Embed | v5 |
| Cluster Copy Files | `/cluster-copy/` | Embed | v5 |
| Cluster Cron Jobs | `/cluster-cron/` | Embed | v5 |
| Cluster Shell Commands | `/cluster-shell/` | Embed | v5 |
| Cluster Software Packages | `/cluster-software/` | Embed | v5 |
| Cluster Usermin Servers | `/cluster-usermin/` | Embed | v5 |
| Cluster Users and Groups | `/cluster-useradmin/` | Embed | v5 |
| Cluster Webmin Servers | `/cluster-webmin/` | Embed | v5 |

---

## Screenshot checklist (for field-level audit)

For each **Gap** or **Partial** row, attach:

1. Menu screenshot (done 2026-05-21)
2. **Form screenshot** (fields, buttons)
3. Expected Qadbak behavior (view / edit / create / delete)

Store under `docs/audit-screenshots/` (optional, not in git).

---

## v1 exit criteria

- [ ] All Virtualmin sidebar rows = **UI** or **Embed** (not Gap, not Link-only)
- [ ] E2E on mareades: domain list, mailbox, DNS record, backup list
- [ ] `VIRTUALMIN_MOCK=false` on production
