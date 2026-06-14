import { execFile } from "node:child_process";
import { readFile, unlink } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { repairAvailable } from "./domain-repair";
import { domainUnixUser } from "./domain-files";
import { getProvisioner } from "./provisioner";
import { nativeFeatureEnabled } from "./provisioner/native-features";
import { runProvisioningHelper } from "./provisioner/native-exec";
import type { Role } from "./types";

const execFileAsync = promisify(execFile);

export interface WebsiteProbeResult {
  ok: boolean;
  status?: number;
  error?: string;
  servingPanelLanding?: boolean;
  cloudflare523?: boolean;
  cloudflare502?: boolean;
  servingApacheDefault?: boolean;
  /** Local probe could not run; public URL is OK. */
  inferredFromPublic?: boolean;
  /** Public hostname does not resolve yet (registrar DNS). */
  dnsPending?: boolean;
}

export interface WebsiteHealthReport {
  domain: string;
  originIp: string;
  repairAvailable: boolean;
  validation: { valid: boolean; messages: string[] };
  localProbe: WebsiteProbeResult;
  publicProbe: WebsiteProbeResult;
  cloudflare: {
    issues: string[];
    dnsChecklist: string[];
  };
  stack?: {
    phpFpmSocket?: string;
    sslDaysLeft?: number | null;
    backupAgeDays?: number | null;
  };
}

function serverOriginIp(): string {
  return (
    process.env.QADBAK_ORIGIN_IP?.trim() ||
    process.env.QADBAK_SERVER_IP?.trim() ||
    ""
  );
}

function looksLikeQadbakLanding(body: string, headers: Headers): boolean {
  const powered = headers.get("x-powered-by") ?? "";
  if (/next\.js/i.test(powered)) return true;
  const sample = body.slice(0, 12000).toLowerCase();
  return (
    sample.includes("qadbak") &&
    (sample.includes("your hosting panel") || sample.includes("sign in at qadbak"))
  );
}

function looksLikeCloudflare523(body: string, status: number): boolean {
  if (status === 523) return true;
  const sample = body.slice(0, 8000).toLowerCase();
  return sample.includes("error code: 523") || sample.includes("origin is unreachable");
}

/** Strict match — avoids false alarms on normal sites (e.g. short HTML with "Hello"). */
function looksLikeApacheDefaultPage(body: string): boolean {
  const sample = body.slice(0, 40000).toLowerCase();
  return (
    sample.includes("apache2 ubuntu default page") ||
    (sample.includes("/var/www/html") &&
      (sample.includes("replace this file") ||
        sample.includes("before continuing to operate your http server"))) ||
    sample.includes("apache2 debian default page")
  );
}

async function bodyMatchesPublicHtmlIndex(
  domain: string,
  body: string,
): Promise<boolean> {
  const user = domainUnixUser(domain);
  const indexPath = `/home/${user}/public_html/index.html`;
  try {
    const index = await readFile(indexPath, "utf8");
    const norm = (s: string) => s.replace(/\s+/g, " ").trim();
    const snippet = norm(index).slice(0, 160);
    if (snippet.length < 6) return false;
    return norm(body).includes(snippet);
  } catch {
    return false;
  }
}

function looksLikeCloudflare502(body: string, status: number): boolean {
  if (status === 502) return true;
  const sample = body.slice(0, 8000).toLowerCase();
  return (
    sample.includes("error code: 502") ||
    sample.includes("bad gateway") ||
    sample.includes("host error")
  );
}

function headersFromMap(map: Record<string, string>): Headers {
  const h = new Headers();
  for (const [k, v] of Object.entries(map)) h.set(k, v);
  return h;
}

function parseCurlHeaderBlock(raw: string): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([^:]+):\s*(.*)$/i);
    if (m) headers[m[1].toLowerCase()] = m[2];
  }
  return headers;
}

function isDnsPendingError(message: string | undefined): boolean {
  const err = String(message ?? "").toLowerCase();
  return (
    err.includes("enotfound") ||
    err.includes("getaddrinfo") ||
    err.includes("could not resolve") ||
    err.includes("nxdomain") ||
    err.includes("name or service not known")
  );
}

function isNetworkProbeError(message: string | undefined): boolean {
  const err = String(message ?? "").toLowerCase();
  return (
    err.includes("fetch failed") ||
    err.includes("econnrefused") ||
    err.includes("enotfound") ||
    err.includes("etimedout") ||
    err.includes("socket") ||
    err.includes("no http response") ||
    err.includes("aborted")
  );
}

function apacheBackendBaseUrl(): string {
  const raw =
    process.env.QADBAK_APACHE_BACKEND?.trim() ||
    process.env.APACHE_BACKEND?.trim() ||
    "127.0.0.1:8080";
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw.replace(/\/+$/, "");
  }
  return `http://${raw.replace(/\/+$/, "")}`;
}

async function analyzeHttpResponse(
  status: number,
  body: string,
  headerSource: Headers | Record<string, string>,
  domain: string,
): Promise<WebsiteProbeResult> {
  const headers =
    headerSource instanceof Headers
      ? headerSource
      : headersFromMap(headerSource);
  const servingPanelLanding = looksLikeQadbakLanding(body, headers);
  const cloudflare523 = looksLikeCloudflare523(body, status);
  const cloudflare502 = looksLikeCloudflare502(body, status);
  let servingApacheDefault = looksLikeApacheDefaultPage(body);
  if (servingApacheDefault && (await bodyMatchesPublicHtmlIndex(domain, body))) {
    servingApacheDefault = false;
  }
  const ok =
    status > 0 &&
    status < 500 &&
    !cloudflare523 &&
    !cloudflare502 &&
    !servingPanelLanding &&
    !servingApacheDefault;
  return {
    ok,
    status,
    servingPanelLanding,
    cloudflare523,
    cloudflare502,
    servingApacheDefault,
    error: servingPanelLanding
      ? "This hostname serves the Qadbak marketing page, not public_html."
      : cloudflare523
        ? "Cloudflare error 523 — origin unreachable from the internet."
        : cloudflare502
          ? "Cloudflare error 502 — nginx cannot reach Apache, or HTTPS to origin without a certificate."
          : servingApacheDefault
            ? "Ubuntu/Apache default page — not your public_html."
            : !ok
              ? `HTTP ${status}`
              : undefined,
  };
}

async function probeHttp(
  url: string,
  host: string,
  domain: string,
): Promise<WebsiteProbeResult> {
  try {
    const res = await fetch(url, {
      headers: { Host: host },
      signal: AbortSignal.timeout(12_000),
      redirect: "manual",
    });
    const body = await res.text().catch(() => "");
    return analyzeHttpResponse(res.status, body, res.headers, domain);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "No HTTP response";
    return {
      ok: false,
      error: msg,
      dnsPending: isDnsPendingError(msg),
    };
  }
}

/** curl probe — optional Host override for origin checks on 127.0.0.1. */
async function probeUrlWithCurl(
  url: string,
  domain: string,
  forceHost: boolean,
): Promise<WebsiteProbeResult | null> {
  const bodyPath = path.join(
    tmpdir(),
    `qadbak-probe-b-${randomBytes(8).toString("hex")}.bin`,
  );
  const hdrPath = path.join(
    tmpdir(),
    `qadbak-probe-h-${randomBytes(8).toString("hex")}.txt`,
  );
  try {
    const args = [
      "-sS",
      "--max-time",
      "12",
      "-o",
      bodyPath,
      "-D",
      hdrPath,
      "-w",
      "%{http_code}",
      "-L",
      "--max-redirs",
      "3",
    ];
    if (forceHost) {
      args.push("-H", `Host: ${domain}`);
    }
    args.push(url);
    const { stdout } = await execFileAsync("curl", args, {
      timeout: 18_000,
      maxBuffer: 1024 * 1024,
    });
    const status = Number.parseInt(String(stdout).trim(), 10) || 0;
    if (!status) return null;
    const body = await readFile(bodyPath, "utf8").catch(() => "");
    const hdrRaw = await readFile(hdrPath, "utf8").catch(() => "");
    const blocks = hdrRaw.split(/\r?\n\r?\n/).filter((b) => b.trim());
    const lastBlock = blocks[blocks.length - 1] ?? hdrRaw;
    const headerMap = parseCurlHeaderBlock(lastBlock);
    return analyzeHttpResponse(status, body, headerMap, domain);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "No HTTP response";
    return {
      ok: false,
      error: msg,
      dnsPending: isDnsPendingError(msg),
    };
  } finally {
    await unlink(bodyPath).catch(() => {});
    await unlink(hdrPath).catch(() => {});
  }
}

/** curl with Host header — matches fix-domain-website.sh (works when Node fetch cannot reach :80). */
async function probeLocalWithCurl(
  url: string,
  domain: string,
): Promise<WebsiteProbeResult | null> {
  return probeUrlWithCurl(url, domain, true);
}

async function probeLocalWebsite(domain: string): Promise<WebsiteProbeResult> {
  const targets = [
    "http://127.0.0.1/",
    `${apacheBackendBaseUrl()}/`,
    "http://[::1]/",
  ];
  for (const url of targets) {
    const curl = await probeLocalWithCurl(url, domain);
    if (curl && (curl.ok || curl.status || curl.servingPanelLanding)) {
      return curl;
    }
  }
  return probeHttp("http://127.0.0.1/", domain, domain);
}

async function probePublicWebsite(domain: string): Promise<WebsiteProbeResult> {
  for (const url of [`https://${domain}/`, `http://${domain}/`]) {
    const curl = await probeUrlWithCurl(url, domain, false);
    if (
      curl &&
      (curl.ok ||
        curl.status ||
        curl.servingPanelLanding ||
        curl.cloudflare523 ||
        curl.cloudflare502 ||
        curl.servingApacheDefault ||
        curl.dnsPending)
    ) {
      return curl;
    }
  }
  const https = await probeHttp(`https://${domain}/`, domain, domain);
  if (
    https.ok ||
    https.status ||
    https.servingPanelLanding ||
    https.cloudflare523 ||
    https.cloudflare502 ||
    https.servingApacheDefault ||
    https.dnsPending
  ) {
    return https;
  }
  const http = await probeHttp(`http://${domain}/`, domain, domain);
  if (!http.dnsPending && isDnsPendingError(https.error)) {
    return { ...http, dnsPending: true, error: https.error };
  }
  return http;
}

function buildIssues(
  localProbe: WebsiteProbeResult,
  publicProbe: WebsiteProbeResult,
  validation: { valid: boolean; messages: string[] },
  domain: string,
  originIp: string,
): string[] {
  const issues: string[] = [];

  if (localProbe.servingPanelLanding || publicProbe.servingPanelLanding) {
    issues.push(
      "Nginx routes this domain to the Qadbak landing page — on the VPS: sudo bash scripts/apply-hosting-nginx.sh",
    );
  }

  if (publicProbe.servingApacheDefault) {
    issues.push(
      "Visitors see the Ubuntu/Apache default page, not public_html — use Repair on server (applies to all domains on this VPS).",
    );
  } else if (localProbe.servingApacheDefault && !publicProbe.ok) {
    issues.push(
      "Origin routing may still hit Apache’s default site — use Repair on server (nginx vhosts for every hosted domain).",
    );
  } else if (localProbe.servingApacheDefault && publicProbe.ok) {
    issues.push(
      "Website is live publicly; local curl still hits Apache fallback — optional: Repair once to align origin routing.",
    );
  }

  if (publicProbe.cloudflare523 && localProbe.ok) {
    issues.push(
      "Cloudflare returns 523 but the origin answers locally — check A record / Contabo firewall (ports 80/443).",
    );
  } else if (publicProbe.cloudflare523) {
    issues.push("Cloudflare cannot reach your server (error 523).");
  }

  if (publicProbe.cloudflare502 && localProbe.ok) {
    issues.push(
      "Cloudflare 502 but origin works locally — set SSL mode to Flexible, or install HTTPS on the VPS.",
    );
  } else if (publicProbe.cloudflare502) {
    issues.push(
      "Cloudflare 502 — on VPS: sudo bash scripts/fix-origin-502.sh <domain>",
    );
  }

  if (
    !localProbe.ok &&
    !localProbe.inferredFromPublic &&
    !localProbe.servingPanelLanding &&
    !publicProbe.cloudflare523 &&
    !publicProbe.cloudflare502 &&
    !localProbe.servingApacheDefault &&
    !publicProbe.servingApacheDefault
  ) {
    issues.push(
      "Web server on this VPS does not answer for this domain — use Repair on server.",
    );
  }

  if (!validation.valid) {
    issues.push("The hosting engine reports configuration problems for this domain.");
  }

  if (publicProbe.ok) {
    issues.push(
      localProbe.ok
        ? "Website is reachable locally and on the internet."
        : "Website is live on the internet (public URL). Files in public_html are being served.",
    );
  } else if (
    localProbe.ok &&
    publicProbe.dnsPending &&
    !publicProbe.cloudflare523 &&
    !publicProbe.cloudflare502
  ) {
    issues.push(
      originIp
        ? `Site is ready on this server. Public DNS does not resolve yet — at your registrar set A records @ and www → ${originIp}, or use nameservers ns1.${domain} (BIND on this VPS).`
        : `Site is ready on this server. Public DNS does not resolve yet — point the domain to this VPS (set QADBAK_ORIGIN_IP in .env.local for the exact IP).`,
    );
  } else if (
    localProbe.ok &&
    !publicProbe.cloudflare523 &&
    !publicProbe.cloudflare502 &&
    !publicProbe.servingPanelLanding &&
    !publicProbe.servingApacheDefault
  ) {
    issues.push(
      "Origin responds on this server — if visitors still see errors, check Cloudflare DNS, SSL mode, or cache.",
    );
  }

  return issues;
}

export async function getWebsiteHealth(
  domain: string,
  actor: { role: Role; domains: string[] },
): Promise<WebsiteHealthReport> {
  let validation = { valid: true, messages: [] as string[] };
  if (actor.role === "admin") {
    try {
      validation = await getProvisioner().validateDomain(domain, actor);
    } catch (e) {
      validation = {
        valid: false,
        messages: [
          e instanceof Error ? e.message : "Domain validation failed.",
        ],
      };
    }
  } else {
    validation = {
      valid: true,
      messages: ["Domain validation is only available for administrators."],
    };
  }
  let [localProbe, publicProbe] = await Promise.all([
    probeLocalWebsite(domain),
    probePublicWebsite(domain),
  ]);

  if (
    publicProbe.ok &&
    !localProbe.ok &&
    isNetworkProbeError(localProbe.error) &&
    !localProbe.servingPanelLanding
  ) {
    localProbe = {
      ok: true,
      status: publicProbe.status,
      inferredFromPublic: true,
    };
  }

  const originIp = serverOriginIp();

  const dnsChecklist = [
    originIp
      ? `Cloudflare A record @ → ${originIp} (and www → ${originIp} or CNAME www)`
      : "Set QADBAK_ORIGIN_IP in .env.local to your VPS public IP (Contabo panel).",
    "Contabo cloud firewall: inbound TCP 80 and 443 Accept (before block-all).",
    "Orange cloud (proxy) OK — origin must still be reachable on 80/443.",
    "SSL/TLS: Flexible if origin is HTTP only; Full after Let's Encrypt on the server.",
  ];

  const stack: WebsiteHealthReport["stack"] = {};
  if (nativeFeatureEnabled("runtimes")) {
    try {
      const rt = await runProvisioningHelper("runtimes-get", domain);
      stack.phpFpmSocket = String(rt.phpFpmSocket ?? "");
    } catch {
      /* optional */
    }
  }
  if (actor.role === "admin") {
    try {
      const certs = await getProvisioner().listSslCerts(domain, actor);
      const primary = certs.find((c) => c.host === domain || c.id === domain);
      if (primary?.expiry) {
        const exp = new Date(primary.expiry).getTime();
        stack.sslDaysLeft = Math.ceil((exp - Date.now()) / 86_400_000);
      }
    } catch {
      stack.sslDaysLeft = null;
    }
    if (nativeFeatureEnabled("backup")) {
      try {
        const bl = await runProvisioningHelper("backup-list", domain);
        const files =
          (bl.backups as { modified?: string }[])?.filter((f) => f.modified) ?? [];
        if (files.length) {
          const newest = files.sort((a, b) =>
            String(b.modified).localeCompare(String(a.modified)),
          )[0];
          const ageMs = Date.now() - new Date(String(newest.modified)).getTime();
          stack.backupAgeDays = Math.floor(ageMs / 86_400_000);
        }
      } catch {
        stack.backupAgeDays = null;
      }
    }
  }

  return {
    domain,
    originIp,
    repairAvailable: await repairAvailable(),
    validation,
    localProbe,
    publicProbe,
    cloudflare: {
      issues: buildIssues(localProbe, publicProbe, validation, domain, originIp),
      dnsChecklist,
    },
    stack,
  };
}
