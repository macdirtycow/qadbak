# Qadbak monetization proposal

This document describes the current premium/licensing model, technical gaps, and a recommended path for Community, hosted, and support offerings. **No prices or product names are changed here**; use this as input for a later business decision.

## Current situation

- **Open-source core:** The panel, native stack installer, and domain management are usable without a subscription.
- **Premium features:** Nine feature IDs in `src/lib/premium/features.ts` (white-label, admin updates, off-site backup, webmail UI, multi-tenant clients, panel-client vhost, PHP-FPM isolation, dashboard panel control, client RBAC).
- **License heartbeat:** Optional outbound check to qadbak.com for entitlement; can be disabled or overridden in dev/CI via env.
- **Plans:** Hosting plans (`/admin/plans`) limit disk/bandwidth/features per client account on the VPS.
- **UI locks:** Sidebar and pages show `PremiumNavLock` / `PremiumUpgradeCard` when a feature is not entitled.

## Technical weak points

| Issue | Risk | Mitigation |
|-------|------|------------|
| UI-only hiding | Users can guess API URLs | **Server-side** `requirePremiumFeature()` / `premiumApiError()` on sensitive API routes (branding, updates, panel-control, backups, webmail, etc.) |
| Scattered checks | Some routes check inline | Prefer `requirePremiumFeature()` at the top of each premium API handler |
| Client RBAC | Middleware blocks paths | Keep env + license aligned; document bypass requires server access |
| Frontend route access | Next.js pages may render before fetch fails | Acceptable if API returns 503; pages should show upgrade card when `isPremiumFeatureEnabled` is false |

**Principle:** Never rely on hidden buttons alone. Every premium capability must fail closed on the API.

## Community Edition

- Full native installer and self-hosted panel on the user's VPS.
- All core hosting features (domains, mail, DNS, SSL, files, cron, etc.).
- No artificial breakage of open-source paths.
- Premium features remain **optional** add-ons (license or env in dev).

## Hosted version (optional product)

- Qadbak team runs the panel and stack on managed infrastructure.
- Billing for compute, support SLA, and backups.
- Same codebase; configuration via license + plan templates.
- Not required for open-source users.

## Paid support

- Priority issue triage, upgrade assistance, migration from cPanel/Plesk.
- Sold per server or per organization, not tied to core feature flags.

## Donations / pay what you want

- GitHub Sponsors, Open Collective, or in-panel “Support Qadbak” link.
- Does not gate features; funds docs and maintenance.

## Pros and cons

| Approach | Pros | Cons |
|----------|------|------|
| Community + premium plugins | Clear OSS story; revenue from power users | Must maintain two tiers without resentment |
| Hosted only | Recurring revenue | Ops burden; not for DIY VPS users |
| Support contracts | Aligns with admin audience | Hard to scale without partners |
| Donations | Low friction | Unpredictable income |

## Recommended approach

1. **Keep the core fully self-hostable** on Debian-based Linux (see install docs).
2. **Centralize premium checks** in `requirePremiumFeature()` for any new premium API.
3. **Ship premium as license features**, not scattered booleans in UI components.
4. **Offer hosted + support** as separate products documented on qadbak.com, not enforced in OSS code.
5. **Add a visible “Support / Sponsor”** link in the panel footer (no paywall on core workflows).
6. **Review this doc** before changing prices or renaming tiers.

## Implementation status (this repo)

- Sidebar and settings hub show premium state from server-computed `unlockedPremium`.
- API routes for branding, updates, panel-control, backups, and webmail use server guards.
- `MONETIZATION_PROPOSAL.md` added; pricing unchanged.

## Open questions

- Which premium features should move to Community over time?
- Should license heartbeat be opt-in only for GDPR-sensitive deployments?
- Hosted multi-tenant control plane: same repo or separate service?
