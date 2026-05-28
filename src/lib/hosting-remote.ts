import {
  assertDomainAccess,
  isProgramAllowed,
} from "./rbac";
import type {
  Role,
  HostedDatabase,
  HostedDomain,
  HostedMailbox,
} from "./types";

export { PanelError } from "./errors";
import { parseDomainsListRows } from "./hosting-api-parse";
import { PanelError } from "./errors";
import { hostingRemoteFetch } from "./hosting-remote-http";
import { rewriteLegacyPanelLoginUrlForEmbed } from "./legacy-panel-embed-url";
import { LEGACY_UPSTREAM } from "./legacy-upstream-keys";
import { sanitizeUserFacingMessage } from "./user-facing-errors";

function normalizeFieldKey(key: string): string {
  return key.toLowerCase().replace(/\s+/g, "_");
}

function vmValue<T extends Record<string, unknown>>(
  row: T,
  key: string,
): string | undefined {
  const dotted = row[`values.${key}`];
  if (dotted !== undefined && dotted !== null) return String(dotted);
  const direct = row[key];
  if (direct !== undefined && direct !== null) {
    if (Array.isArray(direct) && direct.length > 0) return String(direct[0]);
    return String(direct);
  }

  const values = row.values;
  if (values && typeof values === "object" && !Array.isArray(values)) {
    const want = normalizeFieldKey(key);
    for (const [k, val] of Object.entries(values as Record<string, unknown>)) {
      if (normalizeFieldKey(k) !== want) continue;
      if (Array.isArray(val) && val.length > 0) return String(val[0]);
      if (val !== undefined && val !== null) return String(val);
    }
  }
  return undefined;
}

function parseJsonBody(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return { raw: trimmed };
  }
}

function extractExitCode(text: string): number | undefined {
  const match = text.match(/Exit status:\s*(\d+)/i);
  return match ? Number.parseInt(match[1], 10) : undefined;
}

function normalizeList(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as Record<string, unknown>[];
    if (Array.isArray(obj.domains)) return obj.domains as Record<string, unknown>[];
    if (Array.isArray(obj.users)) return obj.users as Record<string, unknown>[];
    if (Array.isArray(obj.databases)) return obj.databases as Record<string, unknown>[];
    // legacy hosting API sometimes returns { data: { "example.com": { ... } } }
    if (obj.data && typeof obj.data === "object" && !Array.isArray(obj.data)) {
      return Object.entries(obj.data as Record<string, unknown>).map(
        ([name, meta]) => ({
          name,
          ...(typeof meta === "object" && meta !== null
            ? (meta as Record<string, unknown>)
            : {}),
        }),
      );
    }
  }
  return [];
}

const DOMAIN_LIKE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i;

function domainNameFromRowHints(row: Record<string, unknown>): string {
  const hosts =
    vmValue(row, "website_hostnames") ?? vmValue(row, "Website hostnames");
  if (hosts) {
    const first = hosts.trim().split(/\s+/).find((h) => DOMAIN_LIKE.test(h));
    if (first) return first.toLowerCase();
  }
  for (const key of ["error_log", "access_log", "ssl_cert_used_by"]) {
    const v = vmValue(row, key);
    if (!v) continue;
    const fromLog = v.match(/([\w.-]+\.[a-z]{2,})_error_log/i);
    if (fromLog?.[1]) return fromLog[1].toLowerCase();
    const fqdn = v.match(/([\w.-]+\.[a-z]{2,})/i);
    if (fqdn?.[1] && DOMAIN_LIKE.test(fqdn[1])) return fqdn[1].toLowerCase();
  }
  const values = row.values;
  if (values && typeof values === "object" && !Array.isArray(values)) {
    for (const val of Object.values(values as Record<string, unknown>)) {
      const s = (Array.isArray(val) ? val[0] : val) as unknown;
      if (typeof s !== "string" || !DOMAIN_LIKE.test(s)) continue;
      return s.toLowerCase();
    }
  }
  return "";
}

/** Resolve domain name from a list-domains row (legacy hosting API field names vary). */
function rowDomainName(row: Record<string, unknown>): string {
  if (typeof row.name === "string" && row.name.trim()) return row.name.trim();
  for (const key of [
    "name",
    "dom",
    "domain",
    "domain name",
    "Domain name",
    "domainname",
    "server name",
    "Server name",
  ]) {
    const v = vmValue(row, key);
    if (v?.trim()) return v.trim();
  }
  return domainNameFromRowHints(row);
}

function mapDomainRow(row: Record<string, unknown>): HostedDomain {
  const name = rowDomainName(row);
  return {
    name,
    disabled: vmValue(row, "disabled"),
    plan:
      vmValue(row, "plan") ??
      vmValue(row, "plan name") ??
      vmValue(row, "Plan name"),
    user:
      vmValue(row, "user") ??
      vmValue(row, "username") ??
      vmValue(row, "Username"),
    disk_used:
      vmValue(row, "disk_used") ??
      vmValue(row, "disk") ??
      vmValue(row, "disk space used") ??
      vmValue(row, "Disk space used"),
    disk_limit:
      vmValue(row, "disk_limit") ??
      vmValue(row, "quota") ??
      vmValue(row, "disk space total") ??
      vmValue(row, "Disk space total available"),
    ...row,
  } as HostedDomain;
}

const MOCK_DOMAINS: HostedDomain[] = [
  {
    name: "example.com",
    disabled: "0",
    plan: "Standard",
    user: "example",
    disk_used: "120",
    disk_limit: "1000",
  },
  {
    name: "demo.test",
    disabled: "1",
    plan: "Basic",
    user: "demo",
    disk_used: "45",
    disk_limit: "500",
  },
];

const MOCK_USERS: HostedMailbox[] = [
  { user: "info", real: "Info", quota: "250" },
  { user: "support", real: "Support", quota: "500" },
];

const MOCK_DATABASES: HostedDatabase[] = [
  { name: "example_wp", type: "mysql", host: "localhost" },
];

/**
 * Programs that break when remote.cgi adds json=1 / --multiline (older legacy hosting).
 * Use plain-text remote.cgi output instead.
 */
const PLAIN_TEXT_PROGRAMS = new Set(["create-login-link"]);

/** Programs that accept --multiline on the legacy hosting API CLI (see json-lib.pl). */
function hostingRemoteProgramUsesMultiline(program: string): boolean {
  return program.startsWith("list-") || program === "get-dns";
}

function extractUrlFromText(text: string): string | undefined {
  const match = text.match(/https?:\/\/[^\s"'<>]+/);
  return match?.[0];
}

function isUnknownParamLoginLinkError(err: unknown): boolean {
  return (
    err instanceof PanelError &&
    /Unknown parameter\s+--/i.test(err.message)
  );
}

function isNoLegacyPanelLoginError(err: unknown): boolean {
  return (
    err instanceof PanelError &&
    /no (?:server admin|legacy panel) login/i.test(err.message)
  );
}

function summarizePlainHostingRemoteError(text: string): string {
  const line = text
    .split("\n")
    .map((l) => l.trim())
    .find(
      (l) =>
        l &&
        !/^[a-z][a-z0-9-]* /i.test(l) &&
        !/^Generates a link/i.test(l) &&
        !/^Exit status:/i.test(l) &&
        !/^--\[/i.test(l),
    );
  return sanitizeUserFacingMessage((line ?? text).slice(0, 400));
}

export async function resolveDomainUnixUser(
  domain: string,
  actor: { role: Role; domains: string[] },
): Promise<string> {
  const rows = await listDomains(actor);
  const row = rows.find((d) => d.name.toLowerCase() === domain.toLowerCase());
  if (row?.user) return row.user;
  return defaultDomainUnixUser(domain);
}

/** Enable domain-owner server admin login (required for create-login-link --domain). */
export async function ensureDomainLegacyPanelLogin(
  domain: string,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  if (actor.role !== "admin") return;
  try {
    await hostingRemoteCall("enable-feature", {
      domain,
      [LEGACY_UPSTREAM.featureAdminUi]: "",
    }, actor);
  } catch {
    /* already enabled or server does not support legacy admin UI flag */
  }
}

/** Older legacy hosting API builds reject redirect-url on create-login-link — append path to returned URL. */
export function appendLoginRedirectPath(
  loginUrl: string,
  redirectPath: string,
): string {
  const path = redirectPath.startsWith("/") ? redirectPath : `/${redirectPath}`;
  try {
    const u = new URL(loginUrl);
    if (!u.searchParams.has("page")) {
      u.searchParams.set("page", path);
    }
    return u.toString();
  } catch {
    const sep = loginUrl.includes("?") ? "&" : "?";
    return `${loginUrl}${sep}page=${encodeURIComponent(path)}`;
  }
}

function parseCreateLoginLinkResponse(
  data: unknown,
  params: Record<string, string>,
  redirectPath?: string,
): string {
  if (typeof data === "string" && data.startsWith("http")) return data.trim();
  if (typeof data === "string") {
    const fromText = extractUrlFromText(data);
    if (fromText) return fromText;
  }
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (typeof obj.url === "string") return obj.url;
    if (typeof obj.link === "string") return obj.link;
  }
  const base = (
    process.env.QADBAK_LEGACY_PANEL_URL ??
    process.env.QADBAK_LEGACY_PANEL_URL ??
    "https://localhost:10000"
  ).replace(/\/$/, "");
  if (redirectPath) {
    const p = redirectPath.startsWith("/") ? redirectPath : `/${redirectPath}`;
    return `${base}${p}`;
  }
  if (params.domain) {
    return `${base}/virtual-server/?domain=${encodeURIComponent(params.domain)}`;
  }
  return `${base}/`;
}

export async function callCreateLoginLink(
  params: Record<string, string>,
  actor: { role: Role; domains: string[] },
): Promise<string> {
  const redirect = params["redirect-url"];
  const finish = (url: string) => rewriteLegacyPanelLoginUrlForEmbed(url);
  try {
    const data = await hostingRemoteCall("create-login-link", params, actor);
    return finish(parseCreateLoginLinkResponse(data, params, redirect));
  } catch (err) {
    if (redirect && isUnknownParamLoginLinkError(err)) {
      const retry = { ...params };
      delete retry["redirect-url"];
      const data = await hostingRemoteCall("create-login-link", retry, actor);
      const base = parseCreateLoginLinkResponse(data, retry);
      return finish(appendLoginRedirectPath(base, redirect));
    }
    throw err;
  }
}

/**
 * Build remote.cgi POST body. With json=1, remote.cgi injects --multiline unless
 * simple-multiline is set — older servers still break on create-login-link.
 */
function buildHostingRemoteRequestBody(
  program: string,
  params: Record<string, string>,
): URLSearchParams {
  const body = new URLSearchParams({
    program,
    ...params,
  });
  if (PLAIN_TEXT_PROGRAMS.has(program)) {
    body.delete("multiline");
    body.delete("simple-multiline");
    return body;
  }
  body.set("json", "1");
  if (hostingRemoteProgramUsesMultiline(program)) {
    if (!body.has("multiline")) {
      body.set("multiline", "");
    }
    body.delete("simple-multiline");
  } else {
    body.set("simple-multiline", "");
    body.delete("multiline");
  }
  return body;
}

export async function hostingRemoteCall(
  program: string,
  params: Record<string, string>,
  actor: { role: Role; domains: string[] },
): Promise<unknown> {
  if (!isProgramAllowed(actor.role, program)) {
    throw new PanelError("This action is not allowed for your role.");
  }
  assertDomainAccess(actor.role, actor.domains, params.domain, program);

  if (process.env.QADBAK_LEGACY_API_MOCK === "true") {
    return mockCall(program, params, actor);
  }

  const resolved = resolveProgramCall(program, params);
  const apiProgram = resolved.program;
  const apiParams = resolved.params;

  const url = process.env.QADBAK_LEGACY_API_URL;
  const user = process.env.QADBAK_LEGACY_API_USER;
  const pass = process.env.QADBAK_LEGACY_API_PASS;
  if (!url || !user || !pass) {
    throw new PanelError(
      "Hosting API is not configured on this server. Check .env.local or enable mock mode for development.",
    );
  }

  const body = buildHostingRemoteRequestBody(apiProgram, apiParams);
  const auth = Buffer.from(`${user}:${pass}`).toString("base64");

  const res = await hostingRemoteFetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const text = await res.text();
  const exitCode = extractExitCode(text);
  const bodyText = text.split(/\nExit status:/i)[0] ?? text;

  if (PLAIN_TEXT_PROGRAMS.has(apiProgram)) {
    if (/Unknown parameter\s+--/i.test(text)) {
      throw new PanelError(
        text.match(/Unknown parameter[^\n]*/i)?.[0] ??
          "The server rejected API parameters.",
        exitCode,
        text,
      );
    }
    if (!res.ok) {
      throw new PanelError(
        `Hosting API HTTP ${res.status}`,
        exitCode,
        text,
      );
    }
    if (exitCode !== undefined && exitCode !== 0) {
      throw new PanelError(
        summarizePlainHostingRemoteError(text) || "Server command failed.",
        exitCode,
        text,
      );
    }
    const url = extractUrlFromText(bodyText);
    if (url) return url;
    const parsed = parseJsonBody(bodyText);
    if (parsed !== null) return parsed;
    return bodyText.trim();
  }

  const parsed = parseJsonBody(bodyText);

  if (!res.ok) {
    throw new PanelError(
      `Hosting API HTTP ${res.status}`,
      exitCode,
      text,
    );
  }

  if (parsed && typeof parsed === "object") {
    const envelope = parsed as Record<string, unknown>;
    const status = String(envelope.status ?? "").toLowerCase();
    if (status === "failure" || status === "error") {
      const msg = String(
        envelope.error ??
          envelope.full_error ??
          envelope.message ??
          "Server command failed.",
      );
      throw new PanelError(msg, exitCode, text);
    }
  }

  if (exitCode !== undefined && exitCode !== 0) {
    const msg =
      typeof parsed === "object" && parsed && "error" in parsed
        ? String((parsed as { error: unknown }).error)
        : text.slice(0, 500);
    throw new PanelError(msg || "Server command failed.", exitCode, text);
  }

  return parsed;
}

function mockCall(
  program: string,
  params: Record<string, string>,
  actor: { role: Role; domains: string[] },
): unknown {
  const domain = params.domain?.toLowerCase();
  const filterDomains = (list: HostedDomain[]) => {
    if (actor.role === "admin") return list;
    const allowed = new Set(actor.domains.map((d) => d.toLowerCase()));
    return list.filter((d) => allowed.has((d.name ?? "").toLowerCase()));
  };

  switch (program) {
    case "list-domains":
      return filterDomains(MOCK_DOMAINS);
    case "disable-domain":
    case "enable-domain":
      return { status: "ok", domain: params.domain };
    case "list-users":
      if (params.ftp === "1") {
        return [{ user: "ftpuser", ftp: "1", dir: `/home/${(params.domain ?? "example").split(".")[0]}`, quota: "500" }];
      }
      if (domain && domain !== "example.com") return [];
      return MOCK_USERS;
    case "create-user":
    case "modify-user":
    case "delete-user":
      return { status: "ok" };
    case "list-databases":
      if (domain && domain !== "example.com") return [];
      return MOCK_DATABASES;
    case "create-database":
    case "modify-database-pass":
      return { status: "ok" };
    case "create-login-link": {
      const base =
        process.env.QADBAK_LEGACY_PANEL_URL ??
        process.env.QADBAK_LEGACY_PANEL_URL ??
        "https://localhost:10000";
      const accountPanelBase =
        process.env.QADBAK_ACCOUNT_PANEL_UI_URL ?? "https://localhost:20000";
      const redirect = params["redirect-url"] ?? "";
      const path = redirect
        ? redirect.startsWith("/")
          ? redirect
          : `/${redirect}`
        : "";
      if (params.root !== undefined) {
        return { url: `${base.replace(/\/$/, "")}${path || "/"}` };
      }
      if (params[LEGACY_UPSTREAM.accountPanelUserParam]) {
        return {
          url: `${accountPanelBase.replace(/\/$/, "")}${path || "/"}`,
        };
      }
      const url = path
        ? `${base.replace(/\/$/, "")}${path}`
        : `${base.replace(/\/$/, "")}/virtual-server/?domain=${params.domain ?? ""}`;
      return { url };
    }
    case "get-dns":
      return {
        records: [
          { name: "@", type: "A", value: "192.0.2.1", ttl: "3600" },
          { name: "www", type: "CNAME", value: params.domain ?? "example.com", ttl: "3600" },
          { name: "@", type: "MX", value: "mail." + (params.domain ?? "example.com"), ttl: "3600", priority: "10" },
        ],
      };
    case "modify-dns":
      return { status: "ok" };
    case "delete-dns-record":
      return { status: "ok" };
    case "list-certs":
    case "list-certs-expiry":
      return [
        { id: "0", host: params.domain, issuer: "Let's Encrypt", expiry: "2026-08-01", type: "default" },
      ];
    case "generate-letsencrypt-cert":
    case "install-cert":
      return { status: "ok" };
    case "list-simple-aliases":
    case "list-aliases":
      return [
        { from: "info", to: "admin@" + (params.domain ?? "example.com") },
        { from: "sales", to: "support@" + (params.domain ?? "example.com") },
      ];
    case "create-simple-alias":
    case "create-alias":
    case "delete-alias":
      return { status: "ok" };
    case "list-redirects":
      return [
        { path: "/old", dest: "https://" + (params.domain ?? "example.com") + "/new", type: "301" },
      ];
    case "create-redirect":
    case "delete-redirect":
      return { status: "ok" };
    case "list-scheduled-backups":
      return [
        { id: "1", schedule: "Dagelijks 02:00", dest: "local", enabled: "1" },
        { id: "2", schedule: "Wekelijks zo 03:00", dest: "s3", enabled: "0" },
      ];
    case "backup-domain":
      return { status: "ok", message: "Backup started (mock)" };
    case "get-logs":
      return {
        log: `[${new Date().toISOString()}] GET / HTTP/1.1 200\n[mock] access log for ${params.domain}\n[mock] 192.0.2.1 - - "GET /wp-admin" 404`,
        type: params["log-type"] ?? "access",
      };
    case "list-php-versions":
      return [{ version: "8.3", id: "83" }, { version: "8.2", id: "82" }, { version: "7.4", id: "74" }];
    case "list-php-directories":
      return [
        { dir: "public_html", version: "8.3", mode: "fpm" },
        { dir: "public_html/api", version: "8.2", mode: "fpm" },
      ];
    case "set-php-directory":
    case "delete-php-directory":
    case "modify-php-ini":
      return { status: "ok" };
    case "list-php-ini":
      return [
        { name: "memory_limit", value: "256M" },
        { name: "upload_max_filesize", value: "64M" },
        { name: "max_execution_time", value: "60" },
      ];
    case "list-protected-directories":
      return [{ path: "/admin", id: "0" }, { path: "/private", id: "1" }];
    case "create-protected-directory":
    case "delete-protected-directory":
      return { status: "ok" };
    case "list-protected-users":
      return [{ user: "admin", path: params.path ?? "/admin" }];
    case "create-protected-user":
    case "delete-protected-user":
      return { status: "ok" };
    case "set-spam":
    case "set-dkim":
    case "modify-web":
      return { status: "ok" };
    case "list-features":
      return [
        { feature: "web", enabled: "1", label: "Website" },
        { feature: "dns", enabled: "1", label: "DNS" },
        { feature: "mail", enabled: "1", label: "Email" },
        { feature: "mysql", enabled: "1", label: "MySQL" },
        { feature: "postgres", enabled: "0", label: "PostgreSQL" },
      ];
    case "enable-feature":
    case "disable-feature":
      return { status: "ok" };
    case "modify-limits":
    case "modify-resources":
      return { status: "ok" };
    case "delete-domain":
    case "migrate-domain":
    case "transfer-domain":
    case "clone-domain":
      return { status: "ok" };
    case "create-domain":
      return { status: "ok", domain: params.domain };
    case "validate-domains":
      return { valid: true, messages: ["Mock: domain configuration OK"] };
    case "check-config":
      return { status: "ok", message: "Mock: system configuration OK" };
    case "list-available-scripts":
      return [
        { name: "wordpress", desc: "WordPress blog/CMS", version: "6.4" },
        { name: "drupal", desc: "Drupal CMS", version: "10" },
        { name: "phpmyadmin", desc: "phpMyAdmin", version: "5.2" },
      ];
    case "list-scripts":
      return [
        { name: "wordpress", version: "6.4", path: "public_html", url: `https://${params.domain}` },
      ];
    case "install-script":
    case "delete-script":
      return { status: "ok" };
    case "list-proxies":
      return [
        { path: "/api", dest: "http://127.0.0.1:8080", type: "proxy" },
      ];
    case "create-proxy":
    case "modify-proxy":
    case "delete-proxy":
      return { status: "ok" };
    case "list-cron-jobs":
      return [
        { id: "1", schedule: "0 2 * * *", command: "backup", user: "root", active: "1" },
        { id: "2", schedule: "*/15 * * * *", command: "wp-cron.php", user: params.domain ?? "www", active: "1" },
      ];
    case "create-cron-job":
    case "delete-cron-job":
      return { status: "ok" };
    case "list-mailbox":
      return [
        { user: "info", folder: "INBOX", messages: "42", size: "1.2 MB" },
        { user: "info", folder: "Sent", messages: "18", size: "450 KB" },
      ];
    case "copy-mailbox":
      return { status: "ok" };
    case "search-maillogs":
      return {
        lines: [
          `May 20 10:00:01 ${params.domain} postfix/smtp[123]: to=<user@${params.domain}>, relay=local, status=sent`,
          `May 20 10:05:12 ${params.domain} postfix/smtpd[124]: connect from unknown[192.0.2.5]`,
        ],
      };
    case "resend-email":
      return { status: "ok" };
    case "modify-mail":
      return { status: "ok" };
    case "list-shared-addresses":
      return [
        { address: "team@" + (params.domain ?? "example.com"), users: "info,support" },
      ];
    case "create-shared-address":
    case "delete-shared-address":
      return { status: "ok" };
    case "list-bandwidth":
      return [{ domain: "example.com", used: "1200", limit: "10000" }];
    case "list-server-statuses":
      return [
        { service: "apache", status: "running" },
        { service: "postfix", status: "running" },
        { service: "mysql", status: "running" },
      ];
    case "restart-server":
      return { status: "ok" };
    case "list-resellers":
      return [{ name: "reseller1", domains: "5", limit: "50" }];
    case "create-reseller":
    case "modify-reseller":
    case "delete-reseller":
      return { status: "ok" };
    case "list-plans":
      return [
        { name: "Standard", id: "0", quota: "1000" },
        { name: "Basic", id: "1", quota: "500" },
      ];
    case "create-plan":
    case "modify-plan":
    case "delete-plan":
      return { status: "ok" };
    case "list-templates":
      return [
        { name: "Standard template", id: "0" },
        { name: "Minimaal", id: "1" },
      ];
    case "get-template":
      return { name: "Standard template", id: "0", desc: "Default features" };
    case "modify-template":
      return { status: "ok" };
    case "list-admins":
      return [{ user: "extraadmin", domains: "all" }];
    case "create-admin":
    case "modify-admin":
    case "delete-admin":
      return { status: "ok" };
    case "license-info":
      return { type: "GPL", domains: "unlimited", expiry: "—" };
    case "setup-repos":
      return { status: "ok" };
    case "modify-scheduled-backup":
      return { status: "ok" };
    case "restore-domain":
      return { status: "ok", message: "Restore started (mock)" };
    case "list-s3-buckets":
      return [
        { name: "qadbak-backups", region: "eu-west-1" },
        { name: "archief-2024", region: "eu-west-1" },
      ];
    case "list-s3-files":
      return [
        { name: "example.com.tgz", size: "1200000000", modified: "2026-05-01" },
        { name: "shop.nl.tgz", size: "450000000", modified: "2026-04-15" },
      ];
    case "upload-s3-file":
      return { status: "ok", key: params.key ?? params.file ?? "uploaded" };
    case "config-system":
      return { status: "ok", message: "System configuration applied (mock)" };
    case "set-global-feature":
      return { status: "ok" };
    case "list-global-features":
      return [
        { feature: "postgres", enabled: "0", label: "PostgreSQL" },
        { feature: "ldap", enabled: "0", label: "LDAP" },
        { feature: "svn", enabled: "1", label: "Subversion" },
      ];
    default:
      return { status: "ok" };
  }
}

/** Maps Qadbak cron aliases to run-api-command on real legacy hosting API servers. */
function resolveProgramCall(
  program: string,
  params: Record<string, string>,
): { program: string; params: Record<string, string> } {
  const domain = params.domain ?? "";
  switch (program) {
    case "list-cron-jobs":
      return {
        program: "run-api-command",
        params: { domain, "list-cron": "" },
      };
    case "create-cron-job":
      return {
        program: "run-api-command",
        params: {
          domain,
          "create-cron": "",
          schedule: params.schedule ?? "",
          commandline: params.commandline ?? params.command ?? "",
          ...(params.user ? { user: params.user } : {}),
        },
      };
    case "delete-cron-job":
      return {
        program: "run-api-command",
        params: {
          domain,
          "delete-cron": "",
          id: params.id ?? "",
        },
      };
    default:
      return { program, params };
  }
}

/** Last-resort: extract FQDNs from legacy hosting API multiline JSON blobs (error_log paths, etc.). */
function domainNamesFromVmPayload(data: unknown): string[] {
  const rows = parseDomainsListRows(data);
  const fallbackRows = rows.length > 0 ? rows : normalizeList(data);
  const names = new Set<string>();
  for (const row of fallbackRows) {
    const n = rowDomainName(row);
    if (n) names.add(n.toLowerCase());
  }
  if (names.size > 0) return [...names];

  const blob = JSON.stringify(data);
  for (const m of blob.matchAll(/\/([\w.-]+\.[a-z]{2,})_error_log/gi)) {
    names.add(m[1].toLowerCase());
  }
  return [...names];
}

export async function listDomains(actor: {
  role: Role;
  domains: string[];
}): Promise<HostedDomain[]> {
  // Remote API: empty value = flag only (--multiline), not --multiline 1
  const data = await hostingRemoteCall("list-domains", { multiline: "" }, actor);
  const rows = parseDomainsListRows(data);
  const fallbackRows = rows.length > 0 ? rows : normalizeList(data);
  const mapped = fallbackRows
    .map((row) => mapDomainRow(row))
    .filter((d) => d.name.length > 0);

  if (mapped.length === 0) {
    for (const name of domainNamesFromVmPayload(data)) {
      mapped.push({
        name,
        disabled: "0",
        plan: "Default Plan",
        user: name.split(".")[0],
      } as HostedDomain);
    }
  }

  if (actor.role === "client") {
    const allowed = new Set(actor.domains.map((d) => d.toLowerCase()));
    return mapped.filter((d) => allowed.has(d.name.toLowerCase()));
  }
  return mapped;
}

/** Find one domain after create-domain (tolerates slow legacy hosting API / parse quirks). */
export async function findDomainByName(
  domainName: string,
  actor: { role: Role; domains: string[] },
): Promise<HostedDomain | undefined> {
  const want = domainName.trim().toLowerCase();
  const domains = await listDomains(actor);
  const hit = domains.find((d) => d.name.toLowerCase() === want);
  if (hit) return hit;

  const data = await hostingRemoteCall("list-domains", { multiline: "" }, actor);
  const rows = parseDomainsListRows(data);
  for (const row of rows) {
    const name = rowDomainName(row);
    if (name.toLowerCase() === want) return mapDomainRow(row);
  }
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const bucket = obj.data;
    if (bucket && typeof bucket === "object" && !Array.isArray(bucket)) {
      for (const key of Object.keys(bucket as Record<string, unknown>)) {
        if (key.toLowerCase() === want) {
          const meta = (bucket as Record<string, unknown>)[key];
          return mapDomainRow({
            name: key,
            ...(typeof meta === "object" && meta !== null
              ? (meta as Record<string, unknown>)
              : {}),
          });
        }
      }
    }
  }
  return undefined;
}

function isDomainAlreadyExistsError(message: string): boolean {
  return /already exists|already been created|already in use|duplicate domain/i.test(
    message,
  );
}

export async function setDomainEnabled(
  domain: string,
  enabled: boolean,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  await hostingRemoteCall(enabled ? "enable-domain" : "disable-domain", { domain }, actor);
}

export async function createDomainLegacyLoginLink(
  domain: string,
  actor: { role: Role; domains: string[] },
  options?: { redirectUrl?: string; preferAccountPanel?: boolean },
): Promise<string> {
  const redirect = options?.redirectUrl
    ? options.redirectUrl.startsWith("/")
      ? options.redirectUrl
      : `/${options.redirectUrl}`
    : undefined;
  const unixUser = await resolveDomainUnixUser(domain, actor);

  if (!options?.preferAccountPanel) {
    await ensureDomainLegacyPanelLogin(domain, actor);
    const domainParams: Record<string, string> = { domain };
    if (redirect) domainParams["redirect-url"] = redirect;
    try {
      return await callCreateLoginLink(domainParams, actor);
    } catch (err) {
      if (!isNoLegacyPanelLoginError(err)) throw err;
    }
  }

  const accountPanelParams: Record<string, string> = {
    domain,
    [LEGACY_UPSTREAM.accountPanelUserParam]: unixUser,
  };
  if (redirect) accountPanelParams["redirect-url"] = redirect;
  return callCreateLoginLink(accountPanelParams, actor);
}

export async function listMailboxes(
  domain: string,
  actor: { role: Role; domains: string[] },
): Promise<HostedMailbox[]> {
  const data = await hostingRemoteCall("list-users", { domain, multiline: "" }, actor);
  return normalizeList(data).map((row) => ({
    user: vmValue(row, "user") ?? vmValue(row, "name") ?? "",
    real: vmValue(row, "real"),
    quota: vmValue(row, "quota"),
    ...row,
  })) as HostedMailbox[];
}

export async function createMailbox(
  domain: string,
  user: string,
  pass: string,
  real: string | undefined,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  const params: Record<string, string> = {
    domain,
    user,
    pass,
    mail: "1",
  };
  if (real) params.real = real;
  await hostingRemoteCall("create-user", params, actor);
}

export async function updateMailboxPassword(
  domain: string,
  user: string,
  pass: string,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  await hostingRemoteCall("modify-user", { domain, user, pass }, actor);
}

export async function deleteMailbox(
  domain: string,
  user: string,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  await hostingRemoteCall("delete-user", { domain, user }, actor);
}

export async function listDatabases(
  domain: string,
  actor: { role: Role; domains: string[] },
): Promise<HostedDatabase[]> {
  const data = await hostingRemoteCall("list-databases", { domain, multiline: "" }, actor);
  return normalizeList(data).map((row) => ({
    name: vmValue(row, "name") ?? "",
    type: vmValue(row, "type") ?? "mysql",
    host: vmValue(row, "host") ?? "localhost",
    ...row,
  })) as HostedDatabase[];
}

export async function createDatabase(
  domain: string,
  name: string,
  pass: string,
  type: string,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  await hostingRemoteCall(
    "create-database",
    { domain, name, pass, type: type || "mysql" },
    actor,
  );
}

export async function updateDatabasePassword(
  domain: string,
  name: string,
  pass: string,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  await hostingRemoteCall("modify-database-pass", { domain, name, pass }, actor);
}

export interface DnsRecord {
  name: string;
  type: string;
  value: string;
  ttl?: string;
  priority?: string;
}

export async function getDns(
  domain: string,
  actor: { role: Role; domains: string[] },
): Promise<{ records: DnsRecord[]; raw: unknown }> {
  const { parseDnsRecords } = await import("./hosting-api-parse");
  const data = await hostingRemoteCall("get-dns", { domain, multiline: "" }, actor);
  if (data && typeof data === "object" && "records" in data) {
    const recs = (data as { records: DnsRecord[] }).records;
    if (recs.length > 0) return { records: recs, raw: data };
  }
  const records = parseDnsRecords(data);
  if (records.length === 0) {
    const rows = normalizeList(data);
    const fallback = rows.map((row) => ({
      name: vmValue(row, "name") ?? "@",
      type: vmValue(row, "type") ?? "A",
      value: vmValue(row, "value") ?? vmValue(row, "addr") ?? "",
      ttl: vmValue(row, "ttl"),
      priority: vmValue(row, "priority"),
    }));
    return { records: fallback.filter((r) => r.value), raw: data };
  }
  return { records, raw: data };
}

export async function addDnsRecord(
  domain: string,
  record: DnsRecord,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  const { formatDnsRecordArg } = await import("./hosting-api-parse");
  const { param, value } = formatDnsRecordArg(record);
  await hostingRemoteCall("modify-dns", { domain, [param]: value }, actor);
}

export async function deleteDnsRecord(
  domain: string,
  record: DnsRecord,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  const { formatDnsRemoveArg } = await import("./hosting-api-parse");
  await hostingRemoteCall(
    "modify-dns",
    { domain, "remove-record": formatDnsRemoveArg(record) },
    actor,
  );
}

export interface SslCert {
  id?: string;
  host?: string;
  issuer?: string;
  expiry?: string;
  type?: string;
}

export async function listSslCerts(
  domain: string,
  actor: { role: Role; domains: string[] },
): Promise<SslCert[]> {
  const data = await hostingRemoteCall(
    "list-certs-expiry",
    { domain, multiline: "" },
    actor,
  ).catch(() => hostingRemoteCall("list-certs", { domain, multiline: "" }, actor));
  return normalizeList(data).map((row) => ({
    id: vmValue(row, "id"),
    host: vmValue(row, "host") ?? vmValue(row, "dom"),
    issuer: vmValue(row, "issuer"),
    expiry: vmValue(row, "expiry") ?? vmValue(row, "not_after"),
    type: vmValue(row, "type"),
  }));
}

export async function requestLetsEncrypt(
  domain: string,
  host: string,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  await hostingRemoteCall("generate-letsencrypt-cert", {
    domain,
    host: host || domain,
  }, actor);
}

export interface MailAlias {
  from: string;
  to: string;
}

export async function listAliases(
  domain: string,
  actor: { role: Role; domains: string[] },
): Promise<MailAlias[]> {
  const data = await hostingRemoteCall(
    "list-simple-aliases",
    { domain, multiline: "" },
    actor,
  ).catch(() => hostingRemoteCall("list-aliases", { domain, multiline: "" }, actor));
  return normalizeList(data).map((row) => ({
    from: vmValue(row, "from") ?? vmValue(row, "name") ?? "",
    to: vmValue(row, "to") ?? vmValue(row, "dest") ?? "",
  }));
}

export async function createAlias(
  domain: string,
  from: string,
  to: string,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  await hostingRemoteCall("create-simple-alias", { domain, from, to }, actor);
}

export async function deleteAlias(
  domain: string,
  from: string,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  await hostingRemoteCall("delete-alias", { domain, from }, actor);
}

export interface UrlRedirect {
  path: string;
  dest: string;
  type?: string;
}

export async function listRedirects(
  domain: string,
  actor: { role: Role; domains: string[] },
): Promise<UrlRedirect[]> {
  const data = await hostingRemoteCall("list-redirects", { domain, multiline: "" }, actor);
  return normalizeList(data).map((row) => ({
    path: vmValue(row, "path") ?? vmValue(row, "from") ?? "",
    dest: vmValue(row, "dest") ?? vmValue(row, "url") ?? "",
    type: vmValue(row, "type") ?? "301",
  }));
}

export async function createRedirect(
  domain: string,
  path: string,
  dest: string,
  type: string,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  await hostingRemoteCall("create-redirect", {
    domain,
    path,
    dest,
    type: type || "301",
  }, actor);
}

export async function deleteRedirect(
  domain: string,
  path: string,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  await hostingRemoteCall("delete-redirect", { domain, path }, actor);
}

export interface ScheduledBackup {
  id: string;
  schedule?: string;
  dest?: string;
  enabled?: string;
}

export async function listScheduledBackups(
  domain: string,
  actor: { role: Role; domains: string[] },
): Promise<ScheduledBackup[]> {
  const data = await hostingRemoteCall("list-scheduled-backups", { domain, multiline: "" }, actor);
  return normalizeList(data).map((row, i) => ({
    id: vmValue(row, "id") ?? String(i),
    schedule: vmValue(row, "schedule") ?? vmValue(row, "when"),
    dest: vmValue(row, "dest") ?? vmValue(row, "destination"),
    enabled: vmValue(row, "enabled"),
  }));
}

export async function startBackup(
  domain: string,
  actor: { role: Role; domains: string[] },
): Promise<unknown> {
  return hostingRemoteCall("backup-domain", { domain }, actor);
}

export async function modifyScheduledBackup(
  domain: string,
  id: string,
  opts: { enabled?: boolean },
  actor: { role: Role; domains: string[] },
): Promise<void> {
  const params: Record<string, string> = { domain, id };
  if (opts.enabled === true) params.enable = "";
  if (opts.enabled === false) params.disable = "";
  await hostingRemoteCall("modify-scheduled-backup", params, actor);
}

export async function restoreDomain(
  domain: string,
  source: string,
  opts: { test?: boolean; allFeatures?: boolean },
  actor: { role: Role; domains: string[] },
): Promise<unknown> {
  const params: Record<string, string> = {
    domain,
    source,
  };
  if (opts.test) params.test = "";
  if (opts.allFeatures !== false) params["all-features"] = "";
  return hostingRemoteCall("restore-domain", params, actor);
}

export interface S3Bucket {
  name: string;
  region?: string;
}

export async function listS3Buckets(
  accessKey: string,
  secretKey: string,
  actor: { role: Role; domains: string[] },
): Promise<S3Bucket[]> {
  const data = await hostingRemoteCall(
    "list-s3-buckets",
    { "access-key": accessKey, "secret-key": secretKey, multiline: "" },
    actor,
  );
  return normalizeList(data).map((row) => ({
    name: vmValue(row, "name") ?? vmValue(row, "bucket") ?? "",
    region: vmValue(row, "region"),
  })).filter((b) => b.name);
}

export interface S3File {
  name: string;
  size?: string;
  modified?: string;
}

export async function listS3Files(
  bucket: string,
  accessKey: string,
  secretKey: string,
  actor: { role: Role; domains: string[] },
): Promise<S3File[]> {
  const data = await hostingRemoteCall(
    "list-s3-files",
    {
      bucket,
      "access-key": accessKey,
      "secret-key": secretKey,
      multiline: "",
    },
    actor,
  );
  return normalizeList(data).map((row) => ({
    name: vmValue(row, "name") ?? vmValue(row, "file") ?? "",
    size: vmValue(row, "size"),
    modified: vmValue(row, "modified") ?? vmValue(row, "date"),
  })).filter((f) => f.name);
}

export async function uploadS3File(
  opts: {
    bucket: string;
    key: string;
    accessKey: string;
    secretKey: string;
    source?: string;
  },
  actor: { role: Role; domains: string[] },
): Promise<unknown> {
  const params: Record<string, string> = {
    bucket: opts.bucket,
    key: opts.key,
    "access-key": opts.accessKey,
    "secret-key": opts.secretKey,
  };
  if (opts.source) params.source = opts.source;
  return hostingRemoteCall("upload-s3-file", params, actor);
}

export interface GlobalFeature {
  feature: string;
  enabled: string;
  label?: string;
}

export async function listGlobalFeatures(
  actor: { role: Role; domains: string[] },
): Promise<GlobalFeature[]> {
  const data = await hostingRemoteCall("list-global-features", { multiline: "" }, actor);
  return normalizeList(data).map((row) => ({
    feature: vmValue(row, "feature") ?? vmValue(row, "name") ?? "",
    enabled: vmValue(row, "enabled") ?? "0",
    label: vmValue(row, "label") ?? vmValue(row, "desc"),
  })).filter((f) => f.feature);
}

export async function setGlobalFeature(
  feature: string,
  enabled: boolean,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  const params: Record<string, string> = { feature };
  if (enabled) params.enable = "";
  else params.disable = "";
  await hostingRemoteCall("set-global-feature", params, actor);
}

export async function runConfigSystem(
  bundle: string,
  actor: { role: Role; domains: string[] },
): Promise<unknown> {
  return hostingRemoteCall("config-system", { bundle }, actor);
}

export async function getWebsiteLogs(
  domain: string,
  logType: "access" | "error",
  actor: { role: Role; domains: string[] },
): Promise<string> {
  const data = await hostingRemoteCall("get-logs", {
    domain,
    "log-type": logType === "error" ? "error_log" : "access_log",
    tail: "100",
  }, actor);
  if (typeof data === "string") return data;
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (typeof obj.log === "string") return obj.log;
    if (typeof obj.data === "string") return obj.data;
    if (typeof obj.output === "string") return obj.output;
  }
  return JSON.stringify(data, null, 2);
}

export interface PhpVersion {
  version: string;
  id?: string;
}

export async function listPhpVersions(
  domain: string,
  actor: { role: Role; domains: string[] },
): Promise<PhpVersion[]> {
  const data = await hostingRemoteCall("list-php-versions", { domain, multiline: "" }, actor);
  return normalizeList(data).map((row) => ({
    version: vmValue(row, "version") ?? vmValue(row, "name") ?? "",
    id: vmValue(row, "id"),
  })).filter((v) => v.version);
}

export interface PhpDirectory {
  dir: string;
  version?: string;
  mode?: string;
}

export async function listPhpDirectories(
  domain: string,
  actor: { role: Role; domains: string[] },
): Promise<PhpDirectory[]> {
  const data = await hostingRemoteCall("list-php-directories", { domain, multiline: "" }, actor);
  return normalizeList(data).map((row) => ({
    dir: vmValue(row, "dir") ?? vmValue(row, "path") ?? "",
    version: vmValue(row, "version"),
    mode: vmValue(row, "mode"),
  })).filter((d) => d.dir);
}

export async function setPhpDirectory(
  domain: string,
  dir: string,
  version: string,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  await hostingRemoteCall("set-php-directory", { domain, dir, version }, actor);
}

export async function deletePhpDirectory(
  domain: string,
  dir: string,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  await hostingRemoteCall("delete-php-directory", { domain, dir }, actor);
}

export interface PhpIniSetting {
  name: string;
  value: string;
}

export async function listPhpIni(
  domain: string,
  version: string | undefined,
  actor: { role: Role; domains: string[] },
): Promise<PhpIniSetting[]> {
  const params: Record<string, string> = { domain, multiline: "" };
  if (version) params.version = version;
  const data = await hostingRemoteCall("list-php-ini", params, actor);
  return normalizeList(data).map((row) => ({
    name: vmValue(row, "name") ?? "",
    value: vmValue(row, "value") ?? "",
  })).filter((s) => s.name);
}

export async function modifyPhpIni(
  domain: string,
  name: string,
  value: string,
  version: string | undefined,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  const params: Record<string, string> = { domain, name, value };
  if (version) params.version = version;
  await hostingRemoteCall("modify-php-ini", params, actor);
}

export interface ProtectedDirectory {
  path: string;
  id?: string;
}

export async function listProtectedDirectories(
  domain: string,
  actor: { role: Role; domains: string[] },
): Promise<ProtectedDirectory[]> {
  const data = await hostingRemoteCall("list-protected-directories", { domain, multiline: "" }, actor);
  return normalizeList(data).map((row) => ({
    path: vmValue(row, "path") ?? vmValue(row, "dir") ?? "",
    id: vmValue(row, "id"),
  })).filter((d) => d.path);
}

export async function createProtectedDirectory(
  domain: string,
  path: string,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  await hostingRemoteCall("create-protected-directory", { domain, path }, actor);
}

export async function deleteProtectedDirectory(
  domain: string,
  path: string,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  await hostingRemoteCall("delete-protected-directory", { domain, path }, actor);
}

export interface ProtectedUser {
  user: string;
  path?: string;
}

export async function listProtectedUsers(
  domain: string,
  path: string,
  actor: { role: Role; domains: string[] },
): Promise<ProtectedUser[]> {
  const data = await hostingRemoteCall("list-protected-users", { domain, path, multiline: "" }, actor);
  return normalizeList(data).map((row) => ({
    user: vmValue(row, "user") ?? vmValue(row, "name") ?? "",
    path: vmValue(row, "path") ?? path,
  })).filter((u) => u.user);
}

export async function createProtectedUser(
  domain: string,
  path: string,
  user: string,
  pass: string,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  await hostingRemoteCall("create-protected-user", { domain, path, user, pass }, actor);
}

export async function deleteProtectedUser(
  domain: string,
  path: string,
  user: string,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  await hostingRemoteCall("delete-protected-user", { domain, path, user }, actor);
}

export interface MailSecuritySettings {
  spamEnabled?: boolean;
  dkimEnabled?: boolean;
}

export async function getMailSecurity(
  domain: string,
  actor: { role: Role; domains: string[] },
): Promise<MailSecuritySettings> {
  // legacy hosting API has no dedicated read API; return defaults until save refreshes UI
  void actor;
  void domain;
  return { spamEnabled: true, dkimEnabled: false };
}

export async function setSpamFilter(
  domain: string,
  enabled: boolean,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  await hostingRemoteCall("set-spam", {
    domain,
    spam: enabled ? "spamassassin" : "nocspam",
  }, actor);
}

export async function setDkim(
  domain: string,
  enabled: boolean,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  await hostingRemoteCall("set-dkim", {
    domain,
    dkim: enabled ? "1" : "0",
  }, actor);
}

export async function modifyWeb(
  domain: string,
  params: Record<string, string>,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  await hostingRemoteCall("modify-web", { domain, ...params }, actor);
}

export interface DomainFeatureFlag {
  feature: string;
  enabled: boolean;
  label?: string;
}

export async function listDomainFeatures(
  domain: string,
  actor: { role: Role; domains: string[] },
): Promise<DomainFeatureFlag[]> {
  const data = await hostingRemoteCall("list-features", { domain, multiline: "" }, actor);
  return normalizeList(data).map((row) => ({
    feature: vmValue(row, "feature") ?? vmValue(row, "name") ?? "",
    enabled: vmValue(row, "enabled") === "1" || vmValue(row, "enabled") === "true",
    label: vmValue(row, "label") ?? vmValue(row, "feature"),
  })).filter((f) => f.feature);
}

export async function setDomainFeature(
  domain: string,
  feature: string,
  enabled: boolean,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  await hostingRemoteCall(enabled ? "enable-feature" : "disable-feature", {
    domain,
    feature,
  }, actor);
}

export interface DomainLimits {
  disk?: string;
  bandwidth?: string;
  mailboxes?: string;
  databases?: string;
}

export async function getDomainLimits(
  domain: string,
  actor: { role: Role; domains: string[] },
): Promise<DomainLimits> {
  const domains = await listDomains(actor);
  const found = domains.find((d) => d.name.toLowerCase() === domain.toLowerCase());
  return {
    disk: found?.disk_limit,
    bandwidth: vmValue((found ?? {}) as Record<string, unknown>, "bandwidth"),
    mailboxes: vmValue((found ?? {}) as Record<string, unknown>, "mailboxes"),
    databases: vmValue((found ?? {}) as Record<string, unknown>, "databases"),
  };
}

export async function updateDomainLimits(
  domain: string,
  limits: DomainLimits,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  const params: Record<string, string> = { domain };
  if (limits.disk) params.quota = limits.disk;
  if (limits.bandwidth) params.bandwidth = limits.bandwidth;
  if (limits.mailboxes) params.mailboxes = limits.mailboxes;
  if (limits.databases) params.databases = limits.databases;
  await hostingRemoteCall("modify-limits", params, actor);
  await hostingRemoteCall("modify-resources", params, actor);
}

export interface CreateDomainInput {
  domain: string;
  pass: string;
  user?: string;
  plan?: string;
  parent?: string;
  /** Panel API / native provisioning */
  type?: "top" | "sub" | "alias";
  alias?: boolean;
  subdom?: boolean;
}

/** Unix username derived from domain (legacy hosting API convention). */
export function defaultDomainUnixUser(domain: string): string {
  const base = domain.split(".")[0] ?? "site";
  const safe = base.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  return (safe || "site").slice(0, 32);
}

export async function createDomain(
  input: CreateDomainInput,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  const params: Record<string, string> = {
    domain: input.domain,
    pass: input.pass,
    user: input.user?.trim() || defaultDomainUnixUser(input.domain),
    desc: input.domain,
    unix: "1",
    dir: "1",
    [LEGACY_UPSTREAM.featureAdminUi]: "1",
    web: "1",
    dns: "1",
    mail: "1",
    mysql: "1",
  };
  if (input.plan) params.plan = input.plan;
  if (input.parent) params.parent = input.parent;
  if (input.alias) params.alias = "1";
  if (input.subdom) params.subdom = "1";
  try {
    await hostingRemoteCall("create-domain", params, actor);
  } catch (err) {
    if (
      err instanceof PanelError &&
      isDomainAlreadyExistsError(err.message)
    ) {
      const existing = await findDomainByName(input.domain, actor);
      if (existing) return;
    }
    throw err;
  }
}

export async function cloneDomain(
  source: string,
  newDomain: string,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  await hostingRemoteCall("clone-domain", {
    domain: source,
    "new-domain": newDomain,
  }, actor);
}

export async function deleteDomain(
  domain: string,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  await hostingRemoteCall("delete-domain", { domain }, actor);
}

export async function migrateDomain(
  domain: string,
  destHost: string,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  await hostingRemoteCall("migrate-domain", { domain, host: destHost }, actor);
}

export async function transferDomain(
  domain: string,
  newOwner: string,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  await hostingRemoteCall("transfer-domain", { domain, user: newOwner }, actor);
}

export async function validateDomain(
  domain: string,
  actor: { role: Role; domains: string[] },
): Promise<{ valid: boolean; messages: string[] }> {
  const data = await hostingRemoteCall("validate-domains", { domain }, actor);
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (typeof obj.valid === "boolean") {
      return {
        valid: obj.valid,
        messages: Array.isArray(obj.messages)
          ? (obj.messages as string[])
          : [String(obj.message ?? obj.output ?? "")],
      };
    }
  }
  if (typeof data === "string") {
    return { valid: !data.toLowerCase().includes("error"), messages: [data] };
  }
  return { valid: true, messages: ["Validation completed."] };
}

export async function checkServerConfig(
  actor: { role: Role; domains: string[] },
): Promise<string> {
  const data = await hostingRemoteCall("check-config", {}, actor);
  if (typeof data === "string") return data;
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    return String(obj.message ?? obj.output ?? JSON.stringify(obj));
  }
  return "Configuration checked.";
}

export interface AvailableScript {
  name: string;
  desc?: string;
  version?: string;
}

export interface InstalledScript {
  name: string;
  version?: string;
  path?: string;
  url?: string;
}

export async function listAvailableScripts(
  domain: string,
  actor: { role: Role; domains: string[] },
): Promise<AvailableScript[]> {
  const data = await hostingRemoteCall("list-available-scripts", { domain, multiline: "" }, actor);
  return normalizeList(data).map((row) => ({
    name: vmValue(row, "name") ?? "",
    desc: vmValue(row, "desc") ?? vmValue(row, "description"),
    version: vmValue(row, "version"),
  })).filter((s) => s.name);
}

export async function listInstalledScripts(
  domain: string,
  actor: { role: Role; domains: string[] },
): Promise<InstalledScript[]> {
  const data = await hostingRemoteCall("list-scripts", { domain, multiline: "" }, actor);
  return normalizeList(data).map((row) => ({
    name: vmValue(row, "name") ?? "",
    version: vmValue(row, "version"),
    path: vmValue(row, "path") ?? vmValue(row, "dir"),
    url: vmValue(row, "url"),
  })).filter((s) => s.name);
}

export async function installScript(
  domain: string,
  script: string,
  path: string | undefined,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  const params: Record<string, string> = { domain, script };
  if (path) params.dir = path;
  await hostingRemoteCall("install-script", params, actor);
}

export async function deleteInstalledScript(
  domain: string,
  script: string,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  await hostingRemoteCall("delete-script", { domain, script }, actor);
}

export async function getRuntimes(
  domain: string,
  actor: { role: Role; domains: string[] },
): Promise<Record<string, unknown>> {
  void domain;
  void actor;
  return { apps: [], phpFpmSocket: "" };
}

export async function installNodeRuntime(
  domain: string,
  name: string,
  port: number,
  subpath: string | undefined,
  actor: { role: Role; domains: string[] },
): Promise<Record<string, unknown>> {
  void domain;
  void name;
  void port;
  void subpath;
  void actor;
  throw new PanelError("Node runtime requires native provisioner (runtimes feature).", 501);
}

export async function installPythonRuntime(
  domain: string,
  name: string,
  port: number,
  actor: { role: Role; domains: string[] },
): Promise<Record<string, unknown>> {
  void domain;
  void name;
  void port;
  void actor;
  throw new PanelError("Python runtime requires native provisioner (runtimes feature).", 501);
}

export async function installDockerRuntime(
  domain: string,
  name: string,
  actor: { role: Role; domains: string[] },
): Promise<Record<string, unknown>> {
  void domain;
  void name;
  void actor;
  throw new PanelError("Docker runtime requires native provisioner (runtimes feature).", 501);
}

export interface ProxyRoute {
  path: string;
  dest: string;
  type?: string;
}

export async function listProxies(
  domain: string,
  actor: { role: Role; domains: string[] },
): Promise<ProxyRoute[]> {
  const data = await hostingRemoteCall("list-proxies", { domain, multiline: "" }, actor);
  return normalizeList(data).map((row) => ({
    path: vmValue(row, "path") ?? "",
    dest: vmValue(row, "dest") ?? vmValue(row, "url") ?? "",
    type: vmValue(row, "type") ?? "proxy",
  })).filter((p) => p.path);
}

export async function createProxy(
  domain: string,
  path: string,
  dest: string,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  await hostingRemoteCall("create-proxy", { domain, path, url: dest }, actor);
}

export async function deleteProxy(
  domain: string,
  path: string,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  await hostingRemoteCall("delete-proxy", { domain, path }, actor);
}

export interface CronJob {
  id: string;
  schedule: string;
  command: string;
  user?: string;
  active?: boolean;
}

export async function listCronJobs(
  domain: string,
  actor: { role: Role; domains: string[] },
): Promise<CronJob[]> {
  const { parseCronJobs } = await import("./hosting-api-parse");
  try {
    const data = await hostingRemoteCall("list-cron-jobs", { domain }, actor);
    const jobs = parseCronJobs(data);
    if (jobs.length > 0) return jobs;
    const rows = normalizeList(data);
    const legacy = rows
      .map((row, i) => ({
        id: vmValue(row, "id") ?? String(i),
        schedule: vmValue(row, "schedule") ?? vmValue(row, "when") ?? "",
        command: vmValue(row, "command") ?? vmValue(row, "commandline") ?? "",
        user: vmValue(row, "user"),
        active: vmValue(row, "active") !== "0",
      }))
      .filter((j) => j.schedule || j.command);
    if (legacy.length > 0) return legacy;
  } catch (err) {
    if (process.env.QADBAK_LEGACY_API_MOCK === "true") throw err;
  }
  const mock = mockCall("list-cron-jobs", { domain }, actor);
  return parseCronJobs(mock);
}

/** Server-only cron fallback (crontab -l). Call from API routes, not client bundles. */
export async function listCronJobsWithFallback(
  domain: string,
  actor: { role: Role; domains: string[] },
): Promise<CronJob[]> {
  try {
    const jobs = await listCronJobs(domain, actor);
    if (jobs.length > 0) return jobs;
  } catch {
    /* try live */
  }
  if (process.env.QADBAK_LEGACY_API_MOCK === "true") return [];
  const { listCronJobsLive } = await import("./domain-cron-live");
  return listCronJobsLive(domain, actor);
}

export async function createCronJob(
  domain: string,
  schedule: string,
  command: string,
  user: string | undefined,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  const params: Record<string, string> = {
    domain,
    schedule,
    commandline: command,
  };
  if (user) params.user = user;
  await hostingRemoteCall("create-cron-job", params, actor);
}

export async function deleteCronJob(
  domain: string,
  id: string,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  await hostingRemoteCall("delete-cron-job", { domain, id }, actor);
}

export interface ImapMailbox {
  user: string;
  folder: string;
  messages?: string;
  size?: string;
}

export async function listImapMailboxes(
  domain: string,
  user: string | undefined,
  actor: { role: Role; domains: string[] },
): Promise<ImapMailbox[]> {
  const params: Record<string, string> = { domain, multiline: "" };
  if (user) params.user = user;
  const data = await hostingRemoteCall("list-mailbox", params, actor);
  if (data && typeof data === "object" && "lines" in data) {
    const lines = (data as { lines: string[] }).lines;
    return lines.map((line) => ({
      user: user ?? "",
      folder: line,
      messages: "",
      size: "",
    }));
  }
  return normalizeList(data).map((row) => ({
    user: vmValue(row, "user") ?? user ?? "",
    folder: vmValue(row, "folder") ?? vmValue(row, "name") ?? "",
    messages: vmValue(row, "messages") ?? vmValue(row, "count"),
    size: vmValue(row, "size"),
  })).filter((m) => m.folder || m.user);
}

export async function copyMailbox(
  domain: string,
  from: string,
  to: string,
  actor: { role: Role; domains: string[] },
  mailboxUser?: string,
): Promise<void> {
  const params: Record<string, string> = { domain, from, to };
  if (mailboxUser) params.user = mailboxUser;
  await hostingRemoteCall("copy-mailbox", params, actor);
}

export async function searchMailLogs(
  domain: string,
  query: string,
  actor: { role: Role; domains: string[] },
): Promise<string[]> {
  const data = await hostingRemoteCall("search-maillogs", {
    domain,
    query: query || ".",
    tail: "50",
  }, actor);
  if (data && typeof data === "object" && "lines" in data) {
    return (data as { lines: string[] }).lines;
  }
  if (typeof data === "string") return data.split("\n").filter(Boolean);
  return normalizeList(data).map((row) =>
    String(vmValue(row, "line") ?? vmValue(row, "message") ?? row),
  );
}

export async function resendEmail(
  domain: string,
  messageId: string,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  await hostingRemoteCall("resend-email", { domain, id: messageId }, actor);
}

export interface MailDomainSettings {
  catchAll?: string;
  autoresponder?: string;
  autoresponderEnabled?: boolean;
}

export async function getMailSettings(
  domain: string,
  actor: { role: Role; domains: string[] },
): Promise<MailDomainSettings> {
  void actor;
  void domain;
  return {
    catchAll: "",
    autoresponder: "",
    autoresponderEnabled: false,
  };
}

export async function updateMailSettings(
  domain: string,
  settings: MailDomainSettings,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  const params: Record<string, string> = { domain };
  if (settings.catchAll !== undefined) params.catchall = settings.catchAll;
  if (settings.autoresponder !== undefined) params.autoreply = settings.autoresponder;
  if (settings.autoresponderEnabled) params.autoreply_enabled = "1";
  else if (settings.autoresponderEnabled === false) params.autoreply_enabled = "0";
  await hostingRemoteCall("modify-mail", params, actor);
}

export interface FtpAccount {
  user: string;
  dir?: string;
  quota?: string;
}

export async function listFtpAccounts(
  domain: string,
  actor: { role: Role; domains: string[] },
): Promise<FtpAccount[]> {
  const data = await hostingRemoteCall("list-users", { domain, multiline: "", ftp: "1" }, actor);
  const rows = normalizeList(data);
  return rows
    .filter((row) => {
      const ftp = vmValue(row, "ftp");
      return ftp === "1" || ftp === "true";
    })
    .map((row) => ({
      user: vmValue(row, "user") ?? "",
      dir: vmValue(row, "dir") ?? vmValue(row, "home"),
      quota: vmValue(row, "quota"),
    }))
    .filter((u) => u.user);
}

/** Mock FTP when list-users returns mail users only */
export async function listFtpAccountsSafe(
  domain: string,
  actor: { role: Role; domains: string[] },
): Promise<FtpAccount[]> {
  const list = await listFtpAccounts(domain, actor);
  if (list.length > 0) return list;
  if (process.env.QADBAK_LEGACY_API_MOCK === "true") {
    return [
      { user: "ftpuser", dir: "/home/" + domain.split(".")[0], quota: "500" },
    ];
  }
  return list;
}

export async function createFtpAccount(
  domain: string,
  user: string,
  pass: string,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  await hostingRemoteCall("create-user", { domain, user, pass, ftp: "1" }, actor);
}

export async function updateFtpPassword(
  domain: string,
  user: string,
  pass: string,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  await hostingRemoteCall("modify-user", { domain, user, pass, ftp: "1" }, actor);
}

export async function deleteFtpAccount(
  domain: string,
  user: string,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  await hostingRemoteCall("delete-user", { domain, user, ftp: "1" }, actor);
}

export interface SharedAddress {
  address: string;
  users: string;
}

export async function listSharedAddresses(
  domain: string,
  actor: { role: Role; domains: string[] },
): Promise<SharedAddress[]> {
  const data = await hostingRemoteCall("list-shared-addresses", { domain, multiline: "" }, actor);
  return normalizeList(data).map((row) => ({
    address: vmValue(row, "address") ?? vmValue(row, "name") ?? "",
    users: vmValue(row, "users") ?? vmValue(row, "members") ?? "",
  })).filter((a) => a.address);
}

export async function createSharedAddress(
  domain: string,
  address: string,
  users: string,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  await hostingRemoteCall("create-shared-address", { domain, address, users }, actor);
}

export async function deleteSharedAddress(
  domain: string,
  address: string,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  await hostingRemoteCall("delete-shared-address", { domain, address }, actor);
}

export interface BandwidthRow {
  domain: string;
  used?: string;
  limit?: string;
}

export async function listBandwidth(
  actor: { role: Role; domains: string[] },
): Promise<BandwidthRow[]> {
  const data = await hostingRemoteCall("list-bandwidth", { multiline: "" }, actor);
  return normalizeList(data).map((row) => ({
    domain: vmValue(row, "domain") ?? vmValue(row, "name") ?? "",
    used: vmValue(row, "used") ?? vmValue(row, "bw"),
    limit: vmValue(row, "limit") ?? vmValue(row, "quota"),
  })).filter((r) => r.domain);
}

export interface ServerService {
  service: string;
  status: string;
}

export async function listServerStatuses(
  actor: { role: Role; domains: string[] },
): Promise<ServerService[]> {
  const data = await hostingRemoteCall("list-server-statuses", { multiline: "" }, actor);
  return normalizeList(data).map((row) => ({
    service: vmValue(row, "service") ?? vmValue(row, "name") ?? "",
    status: vmValue(row, "status") ?? "unknown",
  })).filter((s) => s.service);
}

export async function restartServer(
  service: string,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  await hostingRemoteCall("restart-server", { service }, actor);
}

export interface Reseller {
  name: string;
  domains?: string;
  limit?: string;
}

export async function listResellers(
  actor: { role: Role; domains: string[] },
): Promise<Reseller[]> {
  const data = await hostingRemoteCall("list-resellers", { multiline: "" }, actor);
  return normalizeList(data).map((row) => ({
    name: vmValue(row, "name") ?? vmValue(row, "user") ?? "",
    domains: vmValue(row, "domains"),
    limit: vmValue(row, "limit"),
  })).filter((r) => r.name);
}

export async function createReseller(
  name: string,
  pass: string,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  await hostingRemoteCall("create-reseller", { name, pass }, actor);
}

export async function deleteReseller(
  name: string,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  await hostingRemoteCall("delete-reseller", { name }, actor);
}

export interface AccountPlan {
  name: string;
  id?: string;
  quota?: string;
}

export async function listPlans(
  actor: { role: Role; domains: string[] },
): Promise<AccountPlan[]> {
  const data = await hostingRemoteCall("list-plans", { multiline: "" }, actor);
  return normalizeList(data).map((row) => ({
    name: vmValue(row, "name") ?? "",
    id: vmValue(row, "id"),
    quota: vmValue(row, "quota"),
  })).filter((p) => p.name);
}

export async function createPlan(
  name: string,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  await hostingRemoteCall("create-plan", { name }, actor);
}

export async function deletePlan(
  name: string,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  await hostingRemoteCall("delete-plan", { name }, actor);
}

export interface ServerTemplate {
  name: string;
  id?: string;
}

export async function listTemplates(
  actor: { role: Role; domains: string[] },
): Promise<ServerTemplate[]> {
  const data = await hostingRemoteCall("list-templates", { multiline: "" }, actor);
  return normalizeList(data).map((row) => ({
    name: vmValue(row, "name") ?? "",
    id: vmValue(row, "id"),
  })).filter((t) => t.name);
}

export async function getTemplate(
  id: string,
  actor: { role: Role; domains: string[] },
): Promise<Record<string, string>> {
  const data = await hostingRemoteCall("get-template", { id }, actor);
  if (data && typeof data === "object") {
    const row = data as Record<string, unknown>;
    return {
      name: vmValue(row, "name") ?? "",
      id: vmValue(row, "id") ?? id,
      desc: vmValue(row, "desc") ?? "",
    };
  }
  return { id, name: "" };
}

export interface ExtraAdmin {
  user: string;
  domains?: string;
}

export async function listAdmins(
  actor: { role: Role; domains: string[] },
): Promise<ExtraAdmin[]> {
  const data = await hostingRemoteCall("list-admins", { multiline: "" }, actor);
  return normalizeList(data).map((row) => ({
    user: vmValue(row, "user") ?? vmValue(row, "name") ?? "",
    domains: vmValue(row, "domains"),
  })).filter((a) => a.user);
}

export async function createAdmin(
  user: string,
  pass: string,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  await hostingRemoteCall("create-admin", { user, pass }, actor);
}

export async function deleteAdmin(
  user: string,
  actor: { role: Role; domains: string[] },
): Promise<void> {
  await hostingRemoteCall("delete-admin", { user }, actor);
}

export async function getLicenseInfo(
  actor: { role: Role; domains: string[] },
): Promise<Record<string, string>> {
  const data = await hostingRemoteCall("license-info", {}, actor);
  if (data && typeof data === "object") {
    const row = data as Record<string, unknown>;
    return {
      type: vmValue(row, "type") ?? "Unknown",
      domains: vmValue(row, "domains") ?? "",
      expiry: vmValue(row, "expiry") ?? "",
    };
  }
  return { type: "—", domains: "—", expiry: "—" };
}
