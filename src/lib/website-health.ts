import { repairAvailable } from "./domain-repair";
import { validateDomain } from "./virtualmin";
import type { Role } from "./types";

export interface WebsiteHealthReport {
  domain: string;
  originIp: string;
  repairAvailable: boolean;
  validation: { valid: boolean; messages: string[] };
  localProbe: {
    ok: boolean;
    status?: number;
    error?: string;
    /** True when nginx serves the Qadbak marketing app instead of Apache/public_html */
    servingPanelLanding?: boolean;
  };
  cloudflare: {
    error523LikelyCauses: string[];
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

async function probeLocalWebsite(domain: string): Promise<WebsiteHealthReport["localProbe"]> {
  try {
    const res = await fetch(`http://127.0.0.1/`, {
      headers: { Host: domain },
      signal: AbortSignal.timeout(8000),
      redirect: "manual",
    });
    const body = await res.text().catch(() => "");
    const servingPanelLanding = looksLikeQadbakLanding(body, res.headers);
    return {
      ok: res.status > 0 && res.status < 500 && !servingPanelLanding,
      status: res.status,
      servingPanelLanding,
      error: servingPanelLanding
        ? "Nginx still routes this domain to the Qadbak landing page — run apply-hosting-nginx on the server."
        : undefined,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "No local HTTP response",
    };
  }
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
  const localProbe = await probeLocalWebsite(domain);
  const originIp = serverOriginIp();

  const error523LikelyCauses: string[] = [];
  if (localProbe.servingPanelLanding) {
    error523LikelyCauses.push(
      "This domain hits the Qadbak marketing page instead of public_html — on the VPS run: sudo bash scripts/apply-hosting-nginx.sh",
    );
  } else if (!localProbe.ok) {
    error523LikelyCauses.push(
      "Apache/Nginx is not responding on this server for this domain (run repair on the VPS).",
    );
  }
  if (!validation.valid) {
    error523LikelyCauses.push(
      "VirtualMin reports configuration problems for this domain.",
    );
  }
  if (localProbe.ok) {
    error523LikelyCauses.push(
      "Website works locally — Cloudflare 523 usually means wrong origin IP in Cloudflare or provider firewall blocking ports 80/443.",
    );
  }

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
    cloudflare: { error523LikelyCauses, dnsChecklist },
  };
}
