# Security Policy

Qadbak runs on real production VPS infrastructure — security reports are taken
seriously and responded to fast.

## Supported versions

We patch security issues on the latest `main` branch and the most recent
tagged release. Older versions are not maintained.

| Version            | Security updates |
|--------------------|------------------|
| `main` (HEAD)      | ✅ |
| Latest release     | ✅ |
| Anything older     | ❌ |

## Reporting a vulnerability

**Please do not open a public GitHub issue for security problems.**

Email **security@inveil.net** with:

- A description of the issue and where you found it (file, route, etc.).
- A proof-of-concept or step-by-step reproduction.
- The Qadbak version (`git rev-parse HEAD` from `/opt/qadbak`).
- Your name / handle for the Hall of Fame (optional).

If you'd prefer encrypted email, request our PGP key in your first message and
we'll reply with it inline before you share the details.

### What to expect

| When | What |
|------|------|
| Within **24 hours** | Acknowledgement that the report was received. |
| Within **3 days** | Initial assessment (confirmed / needs more info / not a vuln). |
| Within **14 days** for high/critical | Patch released on `main` and a notice to active license holders. |
| Within **30 days** | Public advisory + credit (unless you ask to stay anonymous). |

## Scope

In scope:

- The Qadbak panel code in this repository (`src/`, `scripts/`, `install/`).
- The `marketing-site/` static pages on qadbak.com.
- The licensing flow on `license.inveil.dev` (server code is private; please
  describe the request you sent and the response you got).

Out of scope:

- Findings that require root on the same VPS (a panel running as root can do
  anything by definition).
- DoS through resource exhaustion (CPU/RAM/disk).
- Outdated browser warnings, missing security headers on `marketing-site/*`
  static HTML, or clickjacking on pages without authenticated actions.
- Vulnerabilities in third-party services (Stripe, Cloudflare, Let's Encrypt) —
  please report those upstream.

## Hall of fame

We thank everyone who has responsibly disclosed an issue. Once we publish the
first advisory, contributors will be listed here.

## Bounty

Qadbak does not currently run a formal bug bounty programme, but for clearly
exploitable issues that affect license-server fulfilment or panel
authentication we'll send a free **lifetime license** as a thank-you.
