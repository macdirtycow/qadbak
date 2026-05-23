/** Full Webmin module catalog (legacy hybrid parity reference). */

export type WebminCatalogCategory =
  | "dashboard"
  | "webmin"
  | "system"
  | "servers"
  | "tools"
  | "networking"
  | "hardware"
  | "cluster";

export interface WebminCatalogModule {
  id: string;
  label: string;
  path: string;
  category: WebminCatalogCategory;
  phase: "v2" | "v3" | "v4" | "v5";
  adminOnly?: boolean;
}

export const WEBMIN_CATALOG: WebminCatalogModule[] = [
  { id: "dashboard", label: "Webmin Dashboard", path: "/", category: "dashboard", phase: "v2" },
  { id: "backup-config", label: "Backup Configuration Files", path: "/backup-config/", category: "webmin", phase: "v2" },
  { id: "settings", label: "Change Language and Theme", path: "/settings/", category: "webmin", phase: "v2" },
  { id: "usermin", label: "Usermin Configuration", path: "/usermin/", category: "webmin", phase: "v2" },
  { id: "webminlog", label: "Webmin Actions Log", path: "/webminlog/", category: "webmin", phase: "v2" },
  { id: "config", label: "Webmin Configuration", path: "/config/", category: "webmin", phase: "v2" },
  { id: "servers", label: "Webmin Servers Index", path: "/servers/", category: "webmin", phase: "v2" },
  { id: "webminusers", label: "Webmin Users", path: "/webminusers/", category: "webmin", phase: "v2" },
  { id: "init", label: "Bootup and Shutdown", path: "/init/", category: "system", phase: "v2" },
  { id: "passwd", label: "Change Passwords", path: "/passwd/", category: "system", phase: "v2" },
  { id: "mount", label: "Disk and Network Filesystems", path: "/mount/", category: "system", phase: "v2" },
  { id: "quota", label: "Disk Quotas", path: "/quota/", category: "system", phase: "v2" },
  { id: "fsdump", label: "Filesystem Backup", path: "/fsdump/", category: "system", phase: "v2" },
  { id: "jailkit", label: "Jailkit Jail Manager", path: "/jailkit/", category: "system", phase: "v2" },
  { id: "logrotate", label: "Log File Rotation", path: "/logrotate/", category: "system", phase: "v2" },
  { id: "mime", label: "MIME Type Programs", path: "/mime/", category: "system", phase: "v2" },
  { id: "pam", label: "PAM Authentication", path: "/pam/", category: "system", phase: "v2" },
  { id: "proc", label: "Running Processes", path: "/proc/", category: "system", phase: "v2" },
  { id: "cron", label: "Scheduled Cron Jobs", path: "/cron/", category: "system", phase: "v2" },
  { id: "package-updates", label: "Software Package Updates", path: "/package-updates/", category: "system", phase: "v2" },
  { id: "software", label: "Software Packages", path: "/software/", category: "system", phase: "v2" },
  { id: "man", label: "System Documentation", path: "/man/", category: "system", phase: "v2" },
  { id: "logviewer", label: "System Logs", path: "/logviewer/", category: "system", phase: "v2" },
  { id: "useradmin", label: "Users and Groups", path: "/useradmin/", category: "system", phase: "v2" },
  { id: "apache", label: "Apache Webserver", path: "/apache/", category: "servers", phase: "v3" },
  { id: "awstats", label: "AWStats Reporting", path: "/awstats/", category: "servers", phase: "v3" },
  { id: "bind8", label: "BIND DNS Server", path: "/bind8/", category: "servers", phase: "v3" },
  { id: "dovecot", label: "Dovecot IMAP/POP3 Server", path: "/dovecot/", category: "servers", phase: "v3" },
  { id: "mysql", label: "MariaDB Database Server", path: "/mysql/", category: "servers", phase: "v3" },
  { id: "nginx", label: "Nginx Webserver", path: "/nginx/", category: "servers", phase: "v3" },
  { id: "postfix", label: "Postfix Mail Server", path: "/postfix/", category: "servers", phase: "v3" },
  { id: "procmail", label: "Procmail Mail Filter", path: "/procmail/", category: "servers", phase: "v3" },
  { id: "proftpd", label: "ProFTPD Server", path: "/proftpd/", category: "servers", phase: "v3" },
  { id: "mailboxes", label: "Read User Mail", path: "/mailboxes/", category: "servers", phase: "v3" },
  { id: "spam", label: "SpamAssassin Mail Filter", path: "/spam/", category: "servers", phase: "v3" },
  { id: "sshd", label: "SSH Server", path: "/sshd/", category: "servers", phase: "v3" },
  { id: "shell", label: "Command Shell", path: "/shell/", category: "tools", phase: "v4" },
  { id: "custom", label: "Custom Commands", path: "/custom/", category: "tools", phase: "v4" },
  { id: "filemin", label: "File Manager", path: "/filemin/", category: "tools", phase: "v4" },
  { id: "tunnel", label: "HTTP Tunnel", path: "/tunnel/", category: "tools", phase: "v4" },
  { id: "cpan", label: "Perl Modules", path: "/cpan/", category: "tools", phase: "v4" },
  { id: "phpini", label: "PHP Configuration", path: "/phpini/", category: "tools", phase: "v4" },
  { id: "htaccess", label: "Protected Web Directories", path: "/htaccess-htpasswd/", category: "tools", phase: "v4" },
  { id: "ruby", label: "Ruby GEMS", path: "/ruby/", category: "tools", phase: "v4" },
  { id: "status", label: "System and Server Status", path: "/status/", category: "tools", phase: "v4" },
  { id: "xterm", label: "Terminal", path: "/xterm/", category: "tools", phase: "v4" },
  { id: "upload", label: "Upload and Download", path: "/upload/", category: "tools", phase: "v4" },
  { id: "bandwidth", label: "Bandwidth Monitoring", path: "/bandwidth/", category: "networking", phase: "v4" },
  { id: "fail2ban", label: "Fail2Ban Intrusion Detector", path: "/fail2ban/", category: "networking", phase: "v4" },
  { id: "firewalld", label: "FirewallD", path: "/firewalld/", category: "networking", phase: "v4" },
  { id: "firewall", label: "Linux Firewall", path: "/firewall/", category: "networking", phase: "v4" },
  { id: "net", label: "Network Configuration", path: "/net/", category: "networking", phase: "v4" },
  { id: "nis", label: "NIS Client and Server", path: "/nis/", category: "networking", phase: "v4" },
  { id: "tcpwrappers", label: "TCP Wrappers", path: "/tcpwrappers/", category: "networking", phase: "v4" },
  { id: "iscsi", label: "iSCSI Client", path: "/iscsi/", category: "hardware", phase: "v4" },
  { id: "raid", label: "Linux RAID", path: "/raid/", category: "hardware", phase: "v4" },
  { id: "lvm", label: "Logical Volume Management", path: "/lvm/", category: "hardware", phase: "v4" },
  { id: "fdisk", label: "Partitions on Local Disks", path: "/fdisk/", category: "hardware", phase: "v4" },
  { id: "lpadmin", label: "Printer Administration", path: "/lpadmin/", category: "hardware", phase: "v4" },
  { id: "time", label: "System Time", path: "/time/", category: "hardware", phase: "v4" },
  { id: "cluster-passwd", label: "Cluster Change Passwords", path: "/cluster-passwd/", category: "cluster", phase: "v5" },
  { id: "cluster-copy", label: "Cluster Copy Files", path: "/cluster-copy/", category: "cluster", phase: "v5" },
  { id: "cluster-cron", label: "Cluster Cron Jobs", path: "/cluster-cron/", category: "cluster", phase: "v5" },
  { id: "cluster-shell", label: "Cluster Shell Commands", path: "/cluster-shell/", category: "cluster", phase: "v5" },
  { id: "cluster-software", label: "Cluster Software Packages", path: "/cluster-software/", category: "cluster", phase: "v5" },
  { id: "cluster-usermin", label: "Cluster Usermin Servers", path: "/cluster-usermin/", category: "cluster", phase: "v5" },
  { id: "cluster-useradmin", label: "Cluster Users and Groups", path: "/cluster-useradmin/", category: "cluster", phase: "v5" },
  { id: "cluster-webmin", label: "Cluster Webmin Servers", path: "/cluster-webmin/", category: "cluster", phase: "v5" },
];

export function catalogByCategory(
  category: WebminCatalogCategory,
): WebminCatalogModule[] {
  return WEBMIN_CATALOG.filter((m) => m.category === category);
}

export function catalogModule(id: string): WebminCatalogModule | undefined {
  return WEBMIN_CATALOG.find((m) => m.id === id);
}

export function catalogMenuPath(category: WebminCatalogCategory): string {
  if (category === "dashboard") return "/admin/status";
  return `/admin/${category}-menu`;
}

export const CATALOG_CATEGORY_LABELS: Record<WebminCatalogCategory, string> = {
  dashboard: "Dashboard",
  webmin: "Webmin",
  system: "System",
  servers: "Servers",
  tools: "Tools",
  networking: "Networking",
  hardware: "Hardware",
  cluster: "Cluster",
};
