import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { findZonePath, dnsAdd } from "./provision-dns.mjs";

const exec = promisify(execFile);

export async function resolveMailHost() {
  const fromEnv =
    process.env.QADBAK_MAIL_HOST?.trim() ||
    process.env.QADBAK_PUBLIC_HOST?.trim() ||
    "";
  if (fromEnv) return fromEnv.replace(/\.$/, "");
  try {
    const { stdout } = await exec("hostname", ["-f"], { timeout: 5000 });
    return stdout.trim() || "mail.example.com";
  } catch {
    return "mail.example.com";
  }
}

export async function resolveOriginIp() {
  const fromEnv = process.env.QADBAK_ORIGIN_IP?.trim();
  if (fromEnv) return fromEnv;
  try {
    const { stdout } = await exec(
      "bash",
      [
        "-c",
        "curl -4 -s --max-time 5 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}'",
      ],
      { timeout: 10_000 },
    );
    return stdout.trim().split(/\s+/)[0] || "";
  } catch {
    return "";
  }
}

/** DNS records users need for inbound mail (any provider). */
export async function mailDnsHints(domain) {
  const mailHost = await resolveMailHost();
  const ip = await resolveOriginIp();
  const d = String(domain).trim().toLowerCase();
  return {
    domain: d,
    mailHost,
    records: [
      {
        type: "MX",
        name: "@",
        priority: "10",
        value: `${mailHost}.`,
        note: "DNS only (not proxied in Cloudflare)",
      },
      ...(ip
        ? [
            {
              type: "A",
              name: "mail",
              value: ip,
              note: "DNS only — IMAP/SMTP host",
            },
          ]
        : []),
      {
        type: "TXT",
        name: "@",
        value: ip ? `v=spf1 mx a ip4:${ip} ~all` : "v=spf1 mx a ~all",
        note: "SPF",
      },
    ],
    ports: "Inbound SMTP: TCP 25 open on this server and provider firewall",
  };
}

function zoneHasMx(text) {
  return /\bIN\s+MX\b/i.test(text);
}

function zoneHasMailA(text, label) {
  const re = new RegExp(`^\\s*${label.replace(/\./g, "\\.")}\\s+`, "im");
  return re.test(text);
}

/** Add MX + mail A to local BIND zone when QADBAK_MAIL_AUTODNS is not false. */
export async function ensureInboundMailDns(domain) {
  const hints = await mailDnsHints(domain);
  const autodns = process.env.QADBAK_MAIL_AUTODNS?.trim().toLowerCase() !== "false";
  if (!autodns) {
    return { ok: true, applied: false, hints, source: "dns-hints-only" };
  }

  try {
    const zonePath = await findZonePath(domain);
    const text = await readFile(zonePath, "utf8");
    const mailHost = hints.mailHost;
    const mailLabel = mailHost.includes(".") ? mailHost.split(".")[0] : "mail";
    const applied = [];

    if (!zoneHasMx(text)) {
      await dnsAdd(domain, {
        name: "@",
        type: "MX",
        priority: "10",
        value: `${mailHost}.`,
      });
      applied.push("MX");
    }

    const ip = await resolveOriginIp();
    if (ip && !zoneHasMailA(text, mailLabel)) {
      await dnsAdd(domain, { name: mailLabel, type: "A", value: ip });
      applied.push(`${mailLabel} A`);
    }

    return {
      ok: true,
      applied: applied.length > 0,
      appliedRecords: applied,
      hints,
      zonePath,
      source: "bind-autodns",
    };
  } catch {
    return { ok: true, applied: false, hints, source: "external-dns" };
  }
}
