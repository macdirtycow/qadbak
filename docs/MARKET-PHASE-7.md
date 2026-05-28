# Market phase 7 — Security suite

## Delivered

- Native firewall UI `/admin/firewall` (UFW status, allow/deny port)
- ModSecurity per-domain config toggle (`modsecurity.json`) — requires nginx module on host
- ClamAV domain scan `malware-scan` → report under domain config `security/`
- Helpers: `provision-firewall.mjs`, `provision-modsecurity.mjs`, `provision-malware.mjs`

## Host packages

```bash
apt install ufw clamav clamav-daemon
# ModSecurity: distro nginx-mod-security or custom build
```

## Exit checklist

- [ ] Open port 8080 from panel; verify `ufw status`
- [ ] Run malware scan on test domain; report file created
- [ ] Toggle ModSecurity; document nginx reload step

## Panel (fase 7)

| Area | Path |
|------|------|
| UFW allow/deny | Admin → **Firewall** |
| WAF + malware + mail security | Domains → **Security** |
| fail2ban preview | Domain security (admin) + Privacy snapshot |

Fase 7 banner op domain Security; firewall gekoppeld in Privacy hub.
