import type { Role } from "./types";

export type FeaturePhase = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface DomainFeature {
  id: string;
  phase: FeaturePhase;
  label: string;
  description: string;
  path: string; // suffix under /domains/[domain]
  programs: {
    admin: readonly string[];
    client: readonly string[];
  };
  adminOnly?: boolean;
  /** Lower = earlier in domain nav (default 50). */
  navOrder?: number;
}

/** All VirtualMin programs used by Qadbak, grouped per feature. */
export const DOMAIN_FEATURES: DomainFeature[] = [
  {
    id: "email",
    phase: 1,
    label: "Email",
    description: "Manage mailboxes",
    path: "email",
    navOrder: 10,
    programs: {
      admin: ["list-users", "create-user", "modify-user", "delete-user"],
      client: ["list-users", "create-user", "modify-user", "delete-user"],
    },
  },
  {
    id: "databases",
    phase: 1,
    label: "Databases",
    description: "MySQL / PostgreSQL",
    path: "databases",
    navOrder: 15,
    programs: {
      admin: ["list-databases", "create-database", "modify-database-pass"],
      client: ["list-databases", "create-database", "modify-database-pass"],
    },
  },
  {
    id: "dns",
    phase: 2,
    label: "DNS",
    description: "View and edit DNS records",
    path: "dns",
    programs: {
      admin: ["get-dns", "modify-dns"],
      client: ["get-dns", "modify-dns"],
    },
  },
  {
    id: "ssl",
    phase: 2,
    label: "SSL",
    description: "Certificates and Let's Encrypt",
    path: "ssl",
    programs: {
      admin: [
        "list-certs",
        "list-certs-expiry",
        "generate-letsencrypt-cert",
        "install-cert",
      ],
      client: ["list-certs", "list-certs-expiry", "generate-letsencrypt-cert"],
    },
  },
  {
    id: "aliases",
    phase: 2,
    label: "Aliases",
    description: "Email forwarding and aliases",
    path: "aliases",
    programs: {
      admin: [
        "list-aliases",
        "list-simple-aliases",
        "create-simple-alias",
        "create-alias",
        "delete-alias",
      ],
      client: [
        "list-simple-aliases",
        "create-simple-alias",
        "delete-alias",
      ],
    },
  },
  {
    id: "redirects",
    phase: 2,
    label: "Redirects",
    description: "URL redirects",
    path: "redirects",
    programs: {
      admin: ["list-redirects", "create-redirect", "delete-redirect"],
      client: ["list-redirects", "create-redirect", "delete-redirect"],
    },
  },
  {
    id: "backups",
    phase: 2,
    label: "Backups",
    description: "Backup, schedule, and restore",
    path: "backups",
    navOrder: 60,
    programs: {
      admin: [
        "backup-domain",
        "list-scheduled-backups",
        "modify-scheduled-backup",
        "restore-domain",
      ],
      client: ["list-scheduled-backups"],
    },
  },
  {
    id: "files",
    phase: 3,
    label: "Files",
    description: "File manager (browser or embedded on live server)",
    path: "files",
    navOrder: 5,
    programs: {
      admin: ["create-login-link"],
      client: ["create-login-link"],
    },
  },
  {
    id: "terminal",
    phase: 3,
    label: "Terminal",
    description: "SSH shell in panel (Webmin xterm)",
    path: "terminal",
    navOrder: 6,
    programs: {
      admin: ["create-login-link"],
      client: ["create-login-link"],
    },
  },
  {
    id: "webmin",
    phase: 3,
    label: "Webmin",
    description: "Virtualmin & Usermin alongside the panel",
    path: "webmin",
    navOrder: 8,
    programs: {
      admin: ["create-login-link"],
      client: ["create-login-link"],
    },
  },
  {
    id: "logs",
    phase: 3,
    label: "Logs",
    description: "Website access and error logs",
    path: "logs",
    navOrder: 55,
    programs: {
      admin: ["get-logs"],
      client: ["get-logs"],
    },
  },
  {
    id: "php",
    phase: 3,
    label: "PHP",
    description: "PHP versions per directory and php.ini",
    path: "php",
    programs: {
      admin: [
        "list-php-versions",
        "list-php-directories",
        "set-php-directory",
        "delete-php-directory",
        "list-php-ini",
        "modify-php-ini",
      ],
      client: [
        "list-php-versions",
        "list-php-directories",
        "set-php-directory",
        "list-php-ini",
        "modify-php-ini",
      ],
    },
  },
  {
    id: "protected",
    phase: 3,
    label: "Protected directories",
    description: "Password-protected website directories",
    path: "protected",
    programs: {
      admin: [
        "list-protected-directories",
        "create-protected-directory",
        "delete-protected-directory",
        "list-protected-users",
        "create-protected-user",
        "delete-protected-user",
      ],
      client: [
        "list-protected-directories",
        "create-protected-directory",
        "list-protected-users",
        "create-protected-user",
        "delete-protected-user",
      ],
    },
  },
  {
    id: "security",
    phase: 3,
    label: "Spam & DKIM",
    description: "Spam filter and DKIM for email",
    path: "security",
    programs: {
      admin: ["set-spam", "set-dkim", "modify-web"],
      client: ["set-spam", "set-dkim"],
    },
  },
  {
    id: "features",
    phase: 4,
    label: "Features",
    description: "Toggle web, mail, DNS, and database",
    path: "features",
    adminOnly: true,
    programs: {
      admin: ["list-features", "enable-feature", "disable-feature"],
      client: [],
    },
  },
  {
    id: "limits",
    phase: 4,
    label: "Limits",
    description: "Disk, mailboxes, and bandwidth",
    path: "limits",
    adminOnly: true,
    programs: {
      admin: ["modify-limits", "modify-resources"],
      client: [],
    },
  },
  {
    id: "lifecycle",
    phase: 4,
    label: "Lifecycle",
    description: "Delete, migrate, validate",
    path: "lifecycle",
    adminOnly: true,
    programs: {
      admin: [
        "delete-domain",
        "migrate-domain",
        "transfer-domain",
        "clone-domain",
        "validate-domains",
        "check-config",
      ],
      client: [],
    },
  },
  {
    id: "scripts",
    phase: 5,
    label: "Scripts",
    description: "WordPress and other installers",
    path: "scripts",
    programs: {
      admin: [
        "list-available-scripts",
        "list-scripts",
        "install-script",
        "delete-script",
      ],
      client: ["list-scripts", "list-available-scripts"],
    },
  },
  {
    id: "proxies",
    phase: 5,
    label: "Proxies",
    description: "Reverse proxy and load balancing",
    path: "proxies",
    programs: {
      admin: ["list-proxies", "create-proxy", "modify-proxy", "delete-proxy"],
      client: ["list-proxies"],
    },
  },
  {
    id: "cron",
    phase: 5,
    label: "Cron",
    description: "Scheduled tasks (via VirtualMin API)",
    path: "cron",
    programs: {
      admin: ["list-cron-jobs", "create-cron-job", "delete-cron-job"],
      client: ["list-cron-jobs"],
    },
  },
  {
    id: "mailboxes",
    phase: 6,
    label: "IMAP",
    description: "Mailboxes and folders (IMAP)",
    path: "mailboxes",
    programs: {
      admin: ["list-mailbox", "copy-mailbox"],
      client: ["list-mailbox"],
    },
  },
  {
    id: "mail-logs",
    phase: 6,
    label: "Mail logs",
    description: "Search mail server logs",
    path: "mail-logs",
    programs: {
      admin: ["search-maillogs", "resend-email"],
      client: ["search-maillogs"],
    },
  },
  {
    id: "mail-settings",
    phase: 6,
    label: "Mail settings",
    description: "Catch-all and autoresponder",
    path: "mail-settings",
    programs: {
      admin: ["modify-mail"],
      client: ["modify-mail"],
    },
  },
  {
    id: "ftp",
    phase: 6,
    label: "FTP",
    description: "FTP accounts for this domain",
    path: "ftp",
    programs: {
      admin: ["list-users", "create-user", "modify-user", "delete-user"],
      client: ["list-users", "create-user", "modify-user", "delete-user"],
    },
  },
  {
    id: "shared",
    phase: 6,
    label: "Shared addresses",
    description: "Shared email address for multiple users",
    path: "shared",
    programs: {
      admin: [
        "list-shared-addresses",
        "create-shared-address",
        "delete-shared-address",
      ],
      client: ["list-shared-addresses"],
    },
  },
];

/** Server-wide VirtualMin programs (phase 7, admin only). */
export const ADMIN_SERVER_PROGRAMS = [
  "list-bandwidth",
  "list-server-statuses",
  "restart-server",
  "list-resellers",
  "create-reseller",
  "modify-reseller",
  "delete-reseller",
  "list-plans",
  "create-plan",
  "modify-plan",
  "delete-plan",
  "list-templates",
  "get-template",
  "modify-template",
  "list-admins",
  "create-admin",
  "modify-admin",
  "delete-admin",
  "license-info",
  "setup-repos",
] as const;

/** Cloud & advanced system programs (phase 8, admin only). */
export const ADMIN_CLOUD_PROGRAMS = [
  "modify-scheduled-backup",
  "restore-domain",
  "list-s3-buckets",
  "list-s3-files",
  "upload-s3-file",
  "config-system",
  "set-global-feature",
  "list-global-features",
] as const;

export const IMPLEMENTED_PHASE: FeaturePhase = 8;

export const ADMIN_NAV = [
  { path: "/admin", label: "Overview" },
  { path: "/admin/status", label: "Status" },
  { path: "/admin/server", label: "Server" },
  { path: "/admin/resellers", label: "Resellers" },
  { path: "/admin/plans", label: "Plans" },
  { path: "/admin/templates", label: "Templates" },
  { path: "/admin/admins", label: "Administrators" },
  { path: "/admin/license", label: "License" },
  { path: "/admin/cloud", label: "Cloud (S3)" },
  { path: "/admin/system", label: "Virtualmin" },
  { path: "/admin/system-menu", label: "System" },
  { path: "/admin/servers-menu", label: "Servers" },
  { path: "/admin/tools-menu", label: "Tools" },
  { path: "/admin/networking-menu", label: "Network" },
  { path: "/admin/hardware-menu", label: "Hardware" },
  { path: "/admin/cluster-menu", label: "Cluster" },
  { path: "/admin/webmin", label: "Webmin links" },
] as const;

const GLOBAL_ADMIN_BASE = [
  "list-domains",
  "create-domain",
  "clone-domain",
  "delete-domain",
  "migrate-domain",
  "transfer-domain",
  "disable-domain",
  "enable-domain",
  "create-login-link",
  "get-command",
  "validate-domains",
  "check-config",
] as const;

export const GLOBAL_PROGRAMS: Record<Role, readonly string[]> = {
  admin: [
    ...GLOBAL_ADMIN_BASE,
    ...(IMPLEMENTED_PHASE >= 7 ? ADMIN_SERVER_PROGRAMS : []),
    ...(IMPLEMENTED_PHASE >= 8 ? ADMIN_CLOUD_PROGRAMS : []),
  ],
  client: ["list-domains", "create-login-link"],
};

export function programsForRole(role: Role): readonly string[] {
  const fromFeatures = DOMAIN_FEATURES.filter((f) => f.phase <= IMPLEMENTED_PHASE)
    .flatMap((f) => (role === "admin" ? f.programs.admin : f.programs.client));
  return [...new Set([...GLOBAL_PROGRAMS[role], ...fromFeatures])];
}

export function featuresForDomain(role: Role, isAdmin: boolean): DomainFeature[] {
  return DOMAIN_FEATURES.filter((f) => {
    if (f.phase > IMPLEMENTED_PHASE) return false;
    if (f.adminOnly && !isAdmin) return false;
    const progs = isAdmin ? f.programs.admin : f.programs.client;
    return progs.length > 0;
  }).sort(
    (a, b) => (a.navOrder ?? 50) - (b.navOrder ?? 50) || a.label.localeCompare(b.label, "en"),
  );
}

export function featureByPath(path: string): DomainFeature | undefined {
  return DOMAIN_FEATURES.find((f) => f.path === path);
}
