import type { Role } from "./types";
import {
  callCreateLoginLink,
  createVirtualMinLoginLink,
  VirtualMinError,
} from "./virtualmin";

export type WebminLoginTarget = "root" | "domain" | "usermin";

export interface WebminModule {
  id: string;
  label: string;
  description: string;
  path: string;
  category: string;
  /** Only for domain-scoped Virtualmin UI */
  virtualmin?: boolean;
  /** Opens Usermin (mailbox / domain owner) */
  usermin?: boolean;
  /** Admin root Webmin only */
  adminOnly?: boolean;
}

export function webminUiBase(): string {
  const embed = process.env.QADBAK_WEBMIN_EMBED_BASE?.replace(/\/$/, "");
  if (embed) return embed;
  const panel = process.env.QADBAK_PANEL_URL?.replace(/\/$/, "");
  if (panel) return `${panel}/embed/webmin`;
  return (
    process.env.WEBMIN_UI_URL ??
    process.env.VIRTUALMIN_UI_URL ??
    "https://localhost:10000"
  ).replace(/\/$/, "");
}

export function userminUiBase(): string {
  const explicit = process.env.USERMIN_UI_URL?.replace(/\/$/, "");
  if (explicit) return explicit;
  const webmin = webminUiBase();
  try {
    const u = new URL(webmin);
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

/** Webmin modules (root / admin). Paths are relative to WEBMIN_UI_URL. */
export const WEBMIN_ADMIN_MODULES: WebminModule[] = [
  {
    id: "dashboard",
    label: "Webmin dashboard",
    description: "System status, disk, and services",
    path: "/",
    category: "System",
  },
  {
    id: "virtualmin",
    label: "Virtualmin",
    description: "All virtual servers and server management",
    path: "/virtual-server/",
    category: "Hosting",
    virtualmin: true,
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

/** Per domain: Virtualmin + Usermin (no root Webmin). */
export const WEBMIN_DOMAIN_MODULES: WebminModule[] = [
  {
    id: "vm-overview",
    label: "Virtualmin overview",
    description: "Domain settings in Virtualmin",
    path: "/virtual-server/",
    category: "Virtualmin",
    virtualmin: true,
  },
  {
    id: "vm-files",
    label: "Virtualmin file manager",
    description: "public_html and home directory",
    path: "/filemin/index.cgi",
    category: "Files",
    virtualmin: true,
  },
  {
    id: "vm-email",
    label: "Email & mailboxes",
    description: "Users and aliases",
    path: "/virtual-server/edit_users.cgi",
    category: "Virtualmin",
    virtualmin: true,
  },
  {
    id: "vm-dns",
    label: "DNS records",
    description: "DNS for this domain",
    path: "/virtual-server/edit_dns.cgi",
    category: "Virtualmin",
    virtualmin: true,
  },
  {
    id: "vm-ssl",
    label: "SSL certificates",
    description: "Certificates and Let's Encrypt",
    path: "/virtual-server/edit_ssl.cgi",
    category: "Virtualmin",
    virtualmin: true,
  },
  {
    id: "vm-databases",
    label: "Databases",
    description: "MySQL databases for this domain",
    path: "/virtual-server/edit_databases.cgi",
    category: "Virtualmin",
    virtualmin: true,
  },
  {
    id: "vm-terminal",
    label: "Terminal (xterm)",
    description: "Shell in Webmin for this domain",
    path: "/xterm/",
    category: "Tools",
    virtualmin: true,
  },
  {
    id: "vm-shell",
    label: "Shell",
    description: "Command shell for this domain",
    path: "/shell/",
    category: "Tools",
    virtualmin: true,
  },
  {
    id: "usermin-mail",
    label: "Usermin webmail",
    description: "Webmail as domain owner",
    path: "/mail/",
    category: "Usermin",
    usermin: true,
  },
  {
    id: "usermin-files",
    label: "Usermin files",
    description: "Files as domain owner",
    path: "/filemin/",
    category: "Usermin",
    usermin: true,
  },
  {
    id: "usermin-password",
    label: "Change password",
    description: "Account password",
    path: "/password/",
    category: "Usermin",
    usermin: true,
  },
];

export function webminModulesForAdmin(): WebminModule[] {
  return WEBMIN_ADMIN_MODULES;
}

export function webminModulesForDomain(): WebminModule[] {
  return WEBMIN_DOMAIN_MODULES;
}

export function fallbackLoginUrl(
  target: WebminLoginTarget,
  opts: { domain?: string; redirectPath?: string },
): string {
  const redirect = normalizeRedirect(opts.redirectPath) ?? "/";
  if (target === "usermin") {
    return `${userminUiBase()}${redirect}`;
  }
  const base = webminUiBase();
  if (target === "domain" && opts.domain) {
    if (opts.redirectPath) return `${base}${redirect}`;
    return `${base}/virtual-server/?domain=${encodeURIComponent(opts.domain)}`;
  }
  return `${base}${redirect}`;
}

export async function createWebminLoginLink(
  actor: { role: Role; domains: string[] },
  options: {
    target: WebminLoginTarget;
    domain?: string;
    userminUser?: string;
    redirectPath?: string;
  },
): Promise<string> {
  if (options.target === "root" && actor.role !== "admin") {
    throw new VirtualMinError(
      "Only administrators may open a Webmin root session.",
    );
  }

  const params: Record<string, string> = {};
  if (options.target === "root") {
    params.root = "";
  } else if (options.target === "usermin") {
    if (!options.userminUser?.trim()) {
      throw new VirtualMinError("Usermin user is missing.");
    }
    params["usermin-user"] = options.userminUser.trim();
  } else {
    if (!options.domain?.trim()) {
      throw new VirtualMinError("Domain is missing.");
    }
    params.domain = options.domain.trim();
  }

  if (options.target === "domain" && options.domain?.trim()) {
    const url = await createVirtualMinLoginLink(options.domain.trim(), actor, {
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
  modules: WebminModule[],
  id: string,
): WebminModule | undefined {
  return modules.find((m) => m.id === id);
}
