import type { Role } from "./types";
import {
  callCreateLoginLink,
  createDomainLegacyLoginLink,
  PanelError,
} from "./hosting-remote";
import { LEGACY_UPSTREAM } from "./legacy-upstream-keys";

export type LegacyPanelLoginTarget = "root" | "domain" | "account-panel";

export interface LegacyPanelModule {
  id: string;
  label: string;
  description: string;
  path: string;
  category: string;
  /** Only for domain-scoped legacy hosting UI */
  legacyPanel?: boolean;
  /** Opens account panel (mailbox / domain owner) */
  accountPanel?: boolean;
  /** Admin root server admin only */
  adminOnly?: boolean;
}

export function legacyPanelUiBase(): string {
  const embed = process.env.QADBAK_LEGACY_PANEL_EMBED_BASE?.replace(/\/$/, "");
  if (embed) return embed;
  const panel = process.env.QADBAK_PANEL_URL?.replace(/\/$/, "");
  if (panel) return `${panel}/embed/legacy-panel`;
  return (
    process.env.QADBAK_LEGACY_PANEL_URL ??
    process.env.QADBAK_LEGACY_PANEL_URL ??
    "https://localhost:10000"
  ).replace(/\/$/, "");
}

export function accountPanelUiBase(): string {
  const explicit = process.env.QADBAK_ACCOUNT_PANEL_UI_URL?.replace(/\/$/, "");
  if (explicit) return explicit;
  const panelBase = legacyPanelUiBase();
  try {
    const u = new URL(panelBase);
    if (u.port === "10000") {
      u.port = "20000";
      return u.origin;
    }
  } catch {
    /* ignore */
  }
  return "https://localhost:20000";
}

function normalizeRedirect(path?: string): string | undefined {
  if (!path) return undefined;
  return path.startsWith("/") ? path : `/${path}`;
}

function parseLoginUrl(data: unknown, fallback: string): string {
  if (typeof data === "string" && data.startsWith("http")) return data;
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (typeof obj.url === "string") return obj.url;
    if (typeof obj.link === "string") return obj.link;
  }
  return fallback;
}

/** server admin modules (root / admin). Paths are relative to QADBAK_LEGACY_PANEL_URL. */
export const LEGACY_PANEL_ADMIN_MODULES: LegacyPanelModule[] = [
  {
    id: "dashboard",
    label: "Server dashboard",
    description: "System status, disk, and services",
    path: "/",
    category: "System",
  },
  {
    id: "legacy-remote",
    label: "Hosting",
    description: "All virtual servers and server management",
    path: "/virtual-server/",
    category: "Hosting",
    legacyPanel: true,
  },
  {
    id: "filemin",
    label: "File Manager",
    description: "Full server file manager (root)",
    path: "/filemin/",
    category: "Files",
    adminOnly: true,
  },
  {
    id: "bind8",
    label: "BIND DNS",
    description: "DNS zones and records at system level",
    path: "/bind8/",
    category: "Network",
    adminOnly: true,
  },
  {
    id: "apache",
    label: "Apache Webserver",
    description: "Apache configuration",
    path: "/apache/",
    category: "Web",
    adminOnly: true,
  },
  {
    id: "nginx",
    label: "Nginx Webserver",
    description: "Nginx configuration",
    path: "/nginx/",
    category: "Web",
    adminOnly: true,
  },
  {
    id: "postfix",
    label: "Postfix",
    description: "Mail transport",
    path: "/postfix/",
    category: "Email",
    adminOnly: true,
  },
  {
    id: "dovecot",
    label: "Dovecot",
    description: "IMAP/POP3 server",
    path: "/dovecot/",
    category: "Email",
    adminOnly: true,
  },
  {
    id: "mysql",
    label: "MySQL",
    description: "MySQL databases and users",
    path: "/mysql/",
    category: "Databases",
    adminOnly: true,
  },
  {
    id: "postgresql",
    label: "PostgreSQL",
    description: "PostgreSQL databases",
    path: "/postgresql/",
    category: "Databases",
    adminOnly: true,
  },
  {
    id: "firewall",
    label: "Linux Firewall",
    description: "iptables / nftables",
    path: "/firewall/",
    category: "Security",
    adminOnly: true,
  },
  {
    id: "fail2ban",
    label: "Fail2ban",
    description: "Intrusion prevention",
    path: "/fail2ban/",
    category: "Security",
    adminOnly: true,
  },
  {
    id: "cron",
    label: "Scheduled commands",
    description: "System cron",
    path: "/cron/",
    category: "System",
    adminOnly: true,
  },
  {
    id: "package-updates",
    label: "Software packages",
    description: "Updates and package management",
    path: "/package-updates/",
    category: "System",
    adminOnly: true,
  },
  {
    id: "logviewer",
    label: "System logs",
    description: "View log files",
    path: "/logviewer/",
    category: "System",
    adminOnly: true,
  },
  {
    id: "sshd",
    label: "SSH server",
    description: "SSH configuration",
    path: "/sshd/",
    category: "Security",
    adminOnly: true,
  },
  {
    id: "net",
    label: "Network",
    description: "Interfaces and routing",
    path: "/net/",
    category: "Network",
    adminOnly: true,
  },
  {
    id: "phpini",
    label: "PHP configuration",
    description: "PHP versions and settings",
    path: "/phpini/",
    category: "Web",
    adminOnly: true,
  },
];

/** Per domain: legacy hosting + account panel (no root server admin). */
export const LEGACY_PANEL_DOMAIN_MODULES: LegacyPanelModule[] = [
  {
    id: "vm-overview",
    label: "Domain overview",
    description: "Domain settings",
    path: "/virtual-server/",
    category: "Hosting",
    legacyPanel: true,
  },
  {
    id: "vm-files",
    label: "Legacy file manager",
    description: "public_html and home directory",
    path: "/filemin/index.cgi",
    category: "Files",
    legacyPanel: true,
  },
  {
    id: "vm-email",
    label: "Email & mailboxes",
    description: "Users and aliases",
    path: "/virtual-server/edit_users.cgi",
    category: "Hosting",
    legacyPanel: true,
  },
  {
    id: "vm-dns",
    label: "DNS records",
    description: "DNS for this domain",
    path: "/virtual-server/edit_dns.cgi",
    category: "Hosting",
    legacyPanel: true,
  },
  {
    id: "vm-ssl",
    label: "SSL certificates",
    description: "Certificates and Let's Encrypt",
    path: "/virtual-server/edit_ssl.cgi",
    category: "Hosting",
    legacyPanel: true,
  },
  {
    id: "vm-databases",
    label: "Databases",
    description: "MySQL databases for this domain",
    path: "/virtual-server/edit_databases.cgi",
    category: "Hosting",
    legacyPanel: true,
  },
  {
    id: "vm-terminal",
    label: "Terminal (xterm)",
    description: "Shell for this domain",
    path: "/xterm/",
    category: "Tools",
    legacyPanel: true,
  },
  {
    id: "vm-shell",
    label: "Shell",
    description: "Command shell for this domain",
    path: "/shell/",
    category: "Tools",
    legacyPanel: true,
  },
  {
    id: "account-panel-mail",
    label: "Qmail",
    description: "Qmail as domain owner",
    path: "/mail/",
    category: "Mail",
    accountPanel: true,
  },
  {
    id: "account-panel-files",
    label: "Mailbox files",
    description: "Files as domain owner",
    path: "/filemin/",
    category: "Mail",
    accountPanel: true,
  },
  {
    id: "account-panel-password",
    label: "Change password",
    description: "Account password",
    path: "/password/",
    category: "Mail",
    accountPanel: true,
  },
];

export function legacyPanelModulesForAdmin(): LegacyPanelModule[] {
  return LEGACY_PANEL_ADMIN_MODULES;
}

export function legacyPanelModulesForDomain(): LegacyPanelModule[] {
  return LEGACY_PANEL_DOMAIN_MODULES;
}

export function fallbackLoginUrl(
  target: LegacyPanelLoginTarget,
  opts: { domain?: string; redirectPath?: string },
): string {
  const redirect = normalizeRedirect(opts.redirectPath) ?? "/";
  if (target === "account-panel") {
    return `${accountPanelUiBase()}${redirect}`;
  }
  const base = legacyPanelUiBase();
  if (target === "domain" && opts.domain) {
    if (opts.redirectPath) return `${base}${redirect}`;
    return `${base}/virtual-server/?domain=${encodeURIComponent(opts.domain)}`;
  }
  return `${base}${redirect}`;
}

export async function createLegacyPanelLoginLink(
  actor: { role: Role; domains: string[] },
  options: {
    target: LegacyPanelLoginTarget;
    domain?: string;
    accountPanelUser?: string;
    redirectPath?: string;
  },
): Promise<string> {
  if (options.target === "root" && actor.role !== "admin") {
    throw new PanelError(
      "Only administrators may open a server admin session.",
    );
  }

  const params: Record<string, string> = {};
  if (options.target === "root") {
    params.root = "";
  } else if (options.target === "account-panel") {
    if (!options.accountPanelUser?.trim()) {
      throw new PanelError("Mailbox user is missing.");
    }
    params[LEGACY_UPSTREAM.accountPanelUserParam] = options.accountPanelUser.trim();
  } else {
    if (!options.domain?.trim()) {
      throw new PanelError("Domain is missing.");
    }
    params.domain = options.domain.trim();
  }

  if (options.target === "domain" && options.domain?.trim()) {
    const url = await createDomainLegacyLoginLink(options.domain.trim(), actor, {
      redirectUrl: options.redirectPath,
    });
    return parseLoginUrl(
      url,
      fallbackLoginUrl(options.target, {
        domain: options.domain,
        redirectPath: options.redirectPath,
      }),
    );
  }

  const redirect = normalizeRedirect(options.redirectPath);
  if (redirect) params["redirect-url"] = redirect;

  const url = await callCreateLoginLink(params, actor);
  return parseLoginUrl(
    url,
    fallbackLoginUrl(options.target, {
      domain: options.domain,
      redirectPath: options.redirectPath,
    }),
  );
}

export function moduleById(
  modules: LegacyPanelModule[],
  id: string,
): LegacyPanelModule | undefined {
  return modules.find((m) => m.id === id);
}
