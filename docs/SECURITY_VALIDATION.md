# Security validation beyond automated CI

Automated checks in GitHub Actions (`.github/workflows/security.yml`):

| Tool | Scope |
|------|--------|
| Semgrep | SAST — common vulnerability patterns in TS/JS and shell |
| CodeQL | GitHub semantic analysis for JavaScript/TypeScript |
| Trivy | Dependency and filesystem CVE scan (CRITICAL/HIGH) |

These complement the QAD-SEC code review and Vitest/Playwright suites. They do **not** replace live infrastructure testing.

## Still requires manual / external validation

The following were identified in `SECURITY_AUDIT.md` and need a **live VPS** or **external pentest**:

1. **Full sudo chain** — after `git pull`, re-run all `configure-*-sudo.sh` scripts and verify `sudo -u qadbak sudo -l` shows per-command rules (no `WRAPPER *`).
2. **Docker escape / tenant isolation** — provision untrusted customer containers and attempt cross-domain file access, host mount breakout, and panel API IDOR between client accounts.
3. **Admin root terminal** — confirm TOTP step-up (`QADBAK_ADMIN_TERMINAL_TOTP=true`), session revocation on logout, and that demo hosts block terminal tokens.
4. **Network exposure** — terminal WS bound to `127.0.0.1`, nginx proxy only, firewall rules for panel port.
5. **External pentest** — recommended before exposing a multi-tenant hosting panel to paying customers.

## Operator checklist after deploy

```bash
cd /opt/qadbak && git pull

# Regenerate per-command sudoers (required after this hardening update)
sudo bash scripts/configure-provisioning-helper-sudo.sh
sudo bash scripts/configure-stack-helper-sudo.sh
sudo bash scripts/configure-host-services-sudo.sh
sudo bash scripts/configure-updates-sudo.sh
sudo bash scripts/configure-domain-fs-sudo.sh

# Panel env hardening
grep -E 'QADBAK_REQUIRE_ADMIN_TOTP|QADBAK_ADMIN_TERMINAL_TOTP|QADBAK_SESSION_MAX_AGE_HOURS' .env.local

sudo bash scripts/update.sh
sudo -u qadbak pm2 restart qadbak-terminal
```

Suggested production values:

```env
QADBAK_REQUIRE_ADMIN_TOTP=true
QADBAK_ADMIN_TERMINAL_TOTP=true
QADBAK_SESSION_MAX_AGE_HOURS=24
```

## Reporting

Open GitHub Security advisories or email the maintainer for confirmed vulnerabilities. Include steps to reproduce on a Qadbak VPS when possible.
