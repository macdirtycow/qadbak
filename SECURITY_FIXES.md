# Qadbak Security Fixes

**Datum:** 12 juli 2026  
**Audit:** [`SECURITY_AUDIT.md`](SECURITY_AUDIT.md)  
**Endpoint inventory:** [`docs/SECURITY_AUDIT_ENDPOINTS.md`](docs/SECURITY_AUDIT_ENDPOINTS.md)

---

## Summary

Implemented P0 security fixes and selected P1 hardening from audit QAD-SEC-001 through QAD-SEC-030. Remaining open items are documented in `SECURITY_AUDIT.md` with status **Open** or **Accepted**.

---

## P0 fixes applied

| ID | Fix |
|----|-----|
| QAD-SEC-001 | `src/lib/docker/compose-policy.ts` — deny privileged, host network, docker.sock, dangerous binds |
| QAD-SEC-003 | Git deploy refactored to argv-based `git` calls + URL/branch validators |
| QAD-SEC-004 | CI pipeline steps validated via `assertCiStep()` |
| QAD-SEC-005 | `scripts/lib/safe-archive-extract.mjs` used by file manager |
| QAD-SEC-006 | Safe tar extract on full backup restore |
| QAD-SEC-007 | Production login blocks weak passwords; `users.json` saved mode `0600` |
| QAD-SEC-008 | Reverse proxy destinations validated (`validateProxyDest`) |

---

## P1 fixes applied

| ID | Fix |
|----|-----|
| QAD-SEC-009 | Compose policy on domain Docker runtimes before `up` |
| QAD-SEC-010 | DNS record validation (type, name, value, no control chars) |
| QAD-SEC-011 | Newsletter click redirects limited to http(s) |
| QAD-SEC-013 | Health minimal response default in production |
| QAD-SEC-015 | Mobile refresh rate limit (30 / 15 min per IP) |
| QAD-SEC-016 | Timing-safe webhook secret comparison |

---

## New files

- `scripts/lib/safe-archive-extract.mjs`
- `scripts/lib/compose-policy.mjs`
- `scripts/lib/validate-proxy-dest.mjs`
- `scripts/lib/validate-git-deploy.mjs`
- `scripts/lib/validate-dns-record.mjs`
- `src/lib/docker/compose-policy.ts`
- `src/lib/security-utils.ts`
- `src/lib/docker/compose-policy.test.ts`
- `src/lib/security-utils.test.ts`
- `src/lib/security/safe-archive.test.ts`
- `src/lib/security/validators.test.ts`

---

## Changed files (production)

- `src/lib/docker/admin-docker.ts`
- `src/lib/users.ts`
- `src/lib/security-config.ts`
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/mobile/refresh/route.ts`
- `src/app/api/newsletter/track/route.ts`
- `src/app/api/domains/[domain]/git-webhook/route.ts`
- `scripts/domain-fs-helper.mjs`
- `scripts/lib/provision-backup.mjs`
- `scripts/lib/provision-panel-phase2.mjs`
- `scripts/lib/provision-panel-complete.mjs`
- `scripts/lib/provision-proxies.mjs`
- `scripts/lib/provision-dns.mjs`
- `scripts/lib/provision-runtimes.mjs`
- `vitest.config.ts`

---

## Test results

```
npm test          → 9 files, 42 tests passed
npm run typecheck → passed
npm audit         → 0 vulnerabilities (info/low/moderate/high/critical)
```

Existing e2e: `e2e/security.spec.ts` (CSRF, IDOR, path traversal, legacy redirect).

---

## Scan results

| Tool | Result |
|------|--------|
| npm audit | 0 vulnerabilities |
| vitest security suite | 42/42 pass |
| tsc --noEmit | pass |
| Semgrep | Not run |
| CodeQL | Not run |
| Trivy (container) | Not run |

---

## Remaining risks (not fixed in this pass)

- **QAD-SEC-022:** File-based rate limits are single-node (cluster deployments need Redis or similar)
- **QAD-SEC-027:** Domain cron arbitrary commands (accepted hosting feature)
- **External validation:** Docker escape, multi-tenant isolation, live VPS pentest — see `docs/SECURITY_VALIDATION.md` and `.github/workflows/security.yml` (Semgrep, CodeQL, Trivy)

## Additional fixes (open items pass)

| ID | Fix |
|----|-----|
| QAD-SEC-002 | Per-command sudoers (`generate-sudoers-allowlist.sh`) + shell allowlists on all helper wrappers |
| QAD-SEC-014 | Session revocation in Node middleware (`session-revocation-sync.ts`); mobile logout revokes access jti |
| QAD-SEC-018 | Admin terminal TOTP step-up (`QADBAK_ADMIN_TERMINAL_TOTP`); terminal JWT binds session jti; WS verifies iss/aud + revocation |
| QAD-SEC-017 | Terminal WS token query string removed — subprotocol only |
| QAD-SEC-019 | S3 upload source restricted to `/home/`, `/opt/qadbak/data/`, `/tmp/qadbak-*` |
| QAD-SEC-020 | NodeSource script downloaded to `/tmp` before execution (no pipe-to-bash) |
| QAD-SEC-021 | Production CSP drops `unsafe-eval` |
| QAD-SEC-023 | Already validated in provisioning (listId + domain); documented |
| QAD-SEC-024 | Seed bcrypt cost raised to 12 |
| QAD-SEC-026 | MongoDB name sanitized to alphanumeric |
| QAD-SEC-028 | `chpasswd-safe.mjs` stdin — no shell for mail/FTP passwords |
| QAD-SEC-012 | Demo password hidden unless `QADBAK_DEMO_SHOW_PASSWORD=true` |
| QAD-SEC-029 | Jellyfin compose policy check before deploy |

---

## Operator actions

1. Set `QADBAK_HEALTH_MINIMAL=true` explicitly if not in production mode
2. Change default `changeme` passwords before exposing panel
3. Enable `QADBAK_REQUIRE_ADMIN_TOTP=true` and `QADBAK_ADMIN_TERMINAL_TOTP=true` for admins
4. Re-run all `configure-*-sudo.sh` after pull (per-command sudoers)
5. Run `sudo bash scripts/check-panel-security.sh` on VPS
6. Restart after deploy: `sudo bash scripts/pull-build-restart.sh` and `sudo bash scripts/pm2-restart-qadbak.sh`

---

## Breaking changes

- Reverse proxy `dest` must be public http(s) URL (no localhost/private IPs)
- Git repo URLs must use https/http/git@/ssh:// without shell metacharacters
- Docker compose (admin + domain) rejects privileged/host/socket mounts
- Production login rejects passwords in weak list unless `QADBAK_ALLOW_WEAK_PASSWORDS=true`
