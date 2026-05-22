import { repairAvailable } from "./domain-repair";
import { validateDomain } from "./virtualmin";
import type { Role } from "./types";

export interface WebsiteProbeResult {
  ok: boolean;
  status?: number;
  error?: string;
  servingPanelLanding?: boolean;
  cloudflare523?: boolean;
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
    (sample.includes("virtualmin") ||
      sample.includes("your hosting panel") ||
      sample.includes("sign in at qadbak"))
  );
}

function looksLikeCloudflare523(body: string, status: number): boolean {
  if (status === 523) return true;
  const sample = body.slice(0, 8000).toLowerCase();
  return sample.includes("error code: 523") || sample.includes("origin is unreachable");
}

async function probeHttp(
  url: string,
  host: string,
): Promise<WebsiteProbeResult> {
  try {
    const res = await fetch(url, {
      headers: { Host: host },
      signal: AbortSignal.timeout(12_000),
      redirect: "manual",
    });
    const body = await res.text().catch(() => "");
    const servingPanelLanding = looksLikeQadbakLanding(body, res.headers);
    const cloudflare523 = looksLikeCloudflare523(body, res.status);
    const ok =
      res.status > 0 &&
      res.status < 500 &&
      !cloudflare523 &&
      !servingPanelLanding;
    return {
      ok,
      status: res.status,
      servingPanelLanding,
      cloudflare523,
      error: servingPanelLanding
        ? "This hostname serves the Qadbak marketing page, not public_html."
        : cloudflare523
          ? "Cloudflare error 523 — origin unreachable from the internet."
          : !ok
            ? `HTTP ${res.status}`
            : undefined,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No HTTP response",
    };
  }
}

async function probeLocalWebsite(domain: string): Promise<WebsiteProbeResult> {
  return probeHttp("http://127.0.0.1/", domain);
}

async function probePublicWebsite(domain: string): Promise<WebsiteProbeResult> {
  const https = await probeHttp(`https://${domain}/`, domain);
  if (https.ok || https.status || https.servingPanelLanding || https.cloudflare523) {
    return https;
  }
  return probeHttp(`http://${domain}/`, domain);
}

function buildIssues(
  localProbe: WebsiteProbeResult,
  publicProbe: WebsiteProbeResult,
  validation: { valid: boolean; messages: string[] },
): string[] {
  const issues: string[] = [];

  if (localProbe.servingPanelLanding || publicProbe.servingPanelLanding) {
    issues.push(
      "Nginx routes this domain to the Qadbak landing page — on the VPS: sudo bash scripts/apply-hosting-nginx.sh",
    );
  }

  if (publicProbe.cloudflare523 && localProbe.ok) {
    issues.push(
      "Cloudflare returns 523 but the origin answers locally — check A record / Contabo firewall (ports 80/443).",
    );
  } else if (publicProbe.cloudflare523) {
    issues.push("Cloudflare cannot reach your server (error 523).");
  }

  if (!localProbe.ok && !localProbe.servingPanelLanding && !publicProbe.cloudflare523) {
    issues.push(
      "Web server on this VPS does not answer for this domain — use Repair on server.",
    );
  }

  if (!validation.valid) {
    issues.push("VirtualMin reports configuration problems for this domain.");
  }

  if (publicProbe.ok && localProbe.ok) {
    issues.push("Website is reachable locally and on the internet.");
  } else if (localProbe.ok && !publicProbe.cloudflare523 && !publicProbe.servingPanelLanding) {
    issues.push(
      "Origin responds on this server — if visitors still see errors, check Cloudflare DNS and SSL mode.",
    );
  }

  return issues;
}

export async function getWebsiteHealth(
  domain: string,
  actor: { role: Role; domains: string[] },
): Promise<WebsiteHealthReport> {
  let validation = { valid: true, messages: [] as string[] };
  try {
    validation = await validateDomain(domain, actor);
  } catch {
    validation = {
      valid: true,
      messages: ["VirtualMin validation is only available for administrators."],
    };
  }
  const [localProbe, publicProbe] = await Promise.all([
    probeLocalWebsite(domain),
    probePublicWebsite(domain),
  ]);
  const originIp = serverOriginIp();

  const dnsChecklist = [
    originIp
      ? `Cloudflare A record @ → ${originIp} (and www → ${originIp} or CNAME www)`
      : "Set QADBAK_ORIGIN_IP in .env.local to your VPS public IP (Contabo panel).",
    "Contabo cloud firewall: inbound TCP 80 and 443 Accept (before block-all).",
    "Orange cloud (proxy) OK — origin must still be reachable on 80/443.",
    "SSL/TLS: Flexible if origin is HTTP only; Full after Let's Encrypt on the server.",
  ];

  return {
    domain,
    originIp,
    repairAvailable: await repairAvailable(),
    validation,
    localProbe,
    publicProbe,
    cloudflare: {
      issues: buildIssues(localProbe, publicProbe, validation),
      dnsChecklist,
    },
  };
}
