/** Market / independence phases 1–8 (see docs/MARKET-FEATURES.md). */

export type PhaseId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type PhaseLink = { href: string; label: string };

export interface PhaseDefinition {
  id: PhaseId;
  title: string;
  subtitle: string;
  summary: string;
  highlights: string[];
  adminLinks: PhaseLink[];
  domainLinks: PhaseLink[];
  docPath: string;
  envKeys: string[];
  verifyCli: string[];
  checklist: string[];
}

export const MARKET_PHASES: PhaseDefinition[] = [
  {
    id: 1,
    title: "Native productie",
    subtitle: "Fase 1 — Fundament",
    summary:
      "Volledig native hosting op de VPS: geen legacy panel in de dagelijkse workflow, gezonde stack, E2E-pariteit voor mail/DNS/SSL/DB/backups.",
    highlights: [
      "QADBAK_PROVISIONER=native",
      "Bestanden, terminal, website repair",
      "Mail, DNS, SSL, databases, cron",
      "Journal + health checks",
    ],
    adminLinks: [
      { href: "/admin/health", label: "Health & self-healing" },
      { href: "/admin/status", label: "System status" },
      { href: "/admin/journal", label: "Action journal" },
      { href: "/domains/new", label: "New domain" },
    ],
    domainLinks: [
      { href: "/domains/[domain]/mail", label: "Mail" },
      { href: "/domains/[domain]/dns", label: "DNS" },
      { href: "/domains/[domain]/ssl", label: "SSL" },
      { href: "/domains/[domain]/backups", label: "Backups" },
    ],
    docPath: "docs/MARKET-PHASE-1.md",
    envKeys: ["QADBAK_PROVISIONER", "QADBAK_LEGACY_API_FALLBACK", "QADBAK_NATIVE_FEATURES"],
    verifyCli: [
      "sudo bash scripts/run-market-phase1-check.sh",
      "curl -sS http://127.0.0.1:3000/api/health | jq .",
    ],
    checklist: [
      "Native mode + legacy fallback uit",
      "Testdomein: mail, DNS, TLS, DB, backup, restore",
      "Clients zien geen legacy embed",
      "Terminal toont domainowner@ prompt",
    ],
  },
  {
    id: 2,
    title: "App-catalogus",
    subtitle: "Fase 2 — One-click apps",
    summary:
      "CMS en tools uit data/app-catalog.json: intent-install met DB + journal, of per-domein pad met rollback.",
    highlights: [
      "WordPress met auto wp-config",
      "Joomla, Drupal, Nextcloud, phpMyAdmin, Matomo",
      "Admin catalogus met zoeken & categorieën",
      "Domains → Apps met visuele picker",
    ],
    adminLinks: [{ href: "/admin/apps", label: "App catalog" }],
    domainLinks: [{ href: "/domains/[domain]/scripts", label: "Domain apps" }],
    docPath: "docs/MARKET-PHASE-2.md",
    envKeys: ["QADBAK_NATIVE_FEATURES=…,scripts"],
    verifyCli: ["ls data/app-catalog.json", "node scripts/provisioning-helper.mjs script-available example.com"],
    checklist: [
      "scripts in QADBAK_NATIVE_FEATURES",
      "Intent-install WordPress op testdomein",
      "Subfolder-install Joomla met rollback",
      "Journal toont alle stappen",
    ],
  },
  {
    id: 3,
    title: "Runtimes",
    subtitle: "Fase 3 — Node, Python, Docker",
    summary:
      "Naast PHP-FPM: Node (systemd + nginx proxy), Python (gunicorn), Docker compose per domein met start/stop/logs.",
    highlights: [
      "PHP socket zichtbaar op runtimes-tab",
      "Node app op subpath",
      "Python gunicorn unit",
      "Docker compose MVP",
    ],
    adminLinks: [{ href: "/admin/phases", label: "Fase-overzicht" }],
    domainLinks: [
      { href: "/domains/[domain]/runtimes", label: "Runtimes" },
      { href: "/domains/[domain]/php", label: "PHP versions" },
      { href: "/domains/[domain]/proxies", label: "Reverse proxies" },
    ],
    docPath: "docs/MARKET-PHASE-3.md",
    envKeys: ["QADBAK_NATIVE_FEATURES=…,runtimes"],
    verifyCli: ["node scripts/provisioning-helper.mjs runtimes-get example.com"],
    checklist: [
      "runtimes in native features",
      "Node install + HTTP antwoord",
      "PHP per directory nog via PHP-tab",
    ],
  },
  {
    id: 4,
    title: "Cloud offsite backups",
    subtitle: "Fase 4 — S3 / B2 / GCS",
    summary:
      "Versleutelde credentials, upload na lokale backup, per-domein policy en remote restore-lijst in het panel.",
    highlights: [
      "data/cloud-credentials.json (versleuteld)",
      "backup-offsite helper na archive",
      "Admin → Cloud (S3)",
      "Domains → Backups offsite toggle",
    ],
    adminLinks: [{ href: "/admin/cloud", label: "Cloud credentials" }],
    domainLinks: [{ href: "/domains/[domain]/backups", label: "Backups & offsite" }],
    docPath: "docs/MARKET-PHASE-4.md",
    envKeys: ["QADBAK_SECRETS_KEY"],
    verifyCli: ["test -f data/cloud-credentials.json && echo ok"],
    checklist: [
      "QADBAK_SECRETS_KEY gezet",
      "Credentials opgeslagen in panel",
      "Offsite aan op testdomein; object in bucket",
      "Remote backup lijst zichtbaar",
    ],
  },
  {
    id: 5,
    title: "Granulaire restore",
    subtitle: "Fase 5 — Bestand & database",
    summary:
      "Blader door backup-archieven en herstel één bestand of één MySQL-database zonder volledige site-restore.",
    highlights: [
      "Archive browser in Backups",
      "Client: public_html bestanden",
      "Admin: database restore uit archive",
      "Audit log per partial restore",
    ],
    adminLinks: [{ href: "/admin/journal", label: "Journal" }],
    domainLinks: [{ href: "/domains/[domain]/backups", label: "Backup wizard" }],
    docPath: "docs/MARKET-PHASE-5.md",
    envKeys: [],
    verifyCli: [
      "node scripts/provisioning-helper.mjs backup-archive-list example.com ARCHIVE.tar.gz",
    ],
    checklist: [
      "index.html uit gisteren terugzetten (client)",
      "Enkele DB restore (admin)",
      "Audit entry backup-restore-file",
    ],
  },
  {
    id: 6,
    title: "Monitoring & alerts",
    subtitle: "Fase 6 — Metrics & notificaties",
    summary:
      "Metrics history (sparklines), alert rules voor disk/memory/load/SSL/backup age via email, Slack of Telegram.",
    highlights: [
      "metrics-history.jsonl snapshots",
      "Status-pagina sparklines 24h/7d/30d",
      "Aanbevolen alert presets",
      "Handmatig evaluate + cron",
    ],
    adminLinks: [
      { href: "/admin/status", label: "Status & alerts" },
      { href: "/admin/health", label: "Health checks" },
    ],
    domainLinks: [{ href: "/domains/[domain]/ssl", label: "SSL expiry" }],
    docPath: "docs/MARKET-PHASE-6.md",
    envKeys: [],
    verifyCli: [
      "node scripts/provisioning-helper.mjs metrics-snapshot",
      "wc -l data/metrics-history.jsonl",
    ],
    checklist: [
      "24u metrics zichtbaar",
      "Cron metrics-snapshot elke 15 min",
      "Test alert bij disk ≥ drempel",
      "Slack/Telegram webhook getest",
    ],
  },
  {
    id: 7,
    title: "Security suite",
    subtitle: "Fase 7 — Firewall, WAF, malware",
    summary:
      "UFW vanuit het panel, ModSecurity per domein, ClamAV scans met quarantaine en fail2ban-status op domain security.",
    highlights: [
      "Admin firewall + fail2ban",
      "ModSecurity + CRS logs",
      "ClamAV schedule + scan",
      "Privacy-kaart op security-tab",
    ],
    adminLinks: [
      { href: "/admin/firewall", label: "Firewall" },
      { href: "/admin/privacy", label: "Privacy & data" },
    ],
    domainLinks: [{ href: "/domains/[domain]/security", label: "Domain security" }],
    docPath: "docs/MARKET-PHASE-7.md",
    envKeys: [],
    verifyCli: [
      "node scripts/provisioning-helper.mjs firewall-status",
      "node scripts/provisioning-helper.mjs fail2ban-status",
    ],
    checklist: [
      "Poort open/dicht via panel",
      "Malware scan rapport",
      "ModSecurity toggle + log viewer",
      "fail2ban zichtbaar voor admin",
    ],
  },
  {
    id: 8,
    title: "Billing API",
    subtitle: "Fase 8 — Integraties",
    summary:
      "REST API v1 met scopes, rate limits, IP-allowlist, WHMCS/Blesta starters en OpenAPI-specificatie.",
    highlights: [
      "Bearer API keys",
      "domains/mail/dns/ssl/backups/suspend",
      "Reseller domain filter",
      "docs/api/openapi.yaml",
    ],
    adminLinks: [
      { href: "/admin/api-keys", label: "API keys" },
      { href: "/admin/resellers", label: "Resellers" },
      { href: "/admin/plans", label: "Plans" },
    ],
    domainLinks: [],
    docPath: "docs/MARKET-PHASE-8.md",
    envKeys: [],
    verifyCli: [
      "curl -H 'Authorization: Bearer qadbak_…' https://panel.example/api/v1/domains",
    ],
    checklist: [
      "API key met IP allowlist",
      "WHMCS create + terminate test",
      "Rate limit gedrag gecontroleerd",
      "OpenAPI gepubliceerd op site",
    ],
  },
];

export function getPhaseDefinition(id: PhaseId): PhaseDefinition | undefined {
  return MARKET_PHASES.find((p) => p.id === id);
}
