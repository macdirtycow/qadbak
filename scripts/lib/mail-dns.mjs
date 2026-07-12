import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { findZonePath, dnsAdd } from "./provision-dns.mjs";

const exec = promisify(execFile);

const IPV4 = /^(\d{1,3}\.){3}\d{1,3}$/;

let envLoaded = false;

async function loadEnvLocal() {
  if (envLoaded) return;
  envLoaded = true;
  const root = process.env.QADBAK_DIR || "/opt/qadbak";
  try {
    const raw = await readFile(path.join(root, ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 1) continue;
      const k = t.slice(0, i).trim();
      if (!k || process.env[k] !== undefined) continue;
      let v = t.slice(i + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      process.env[k] = v;
    }
  } catch {
    /* optional */
  }
}

export function isIpAddress(value) {
  return IPV4.test(String(value || "").trim());
}

export function isMailFqdn(value) {
  const v = String(value || "").trim();
  return v.includes(".") && !isIpAddress(v);
}

export async function resolveMailHost() {
  await loadEnvLocal();
  const candidates = [
    process.env.QADBAK_MAIL_HOST?.trim(),
    process.env.QADBAK_PUBLIC_HOST?.trim(),
  ].filter(Boolean);
  for (const c of candidates) {
    if (isMailFqdn(c)) return c.replace(/\.$/, "");
  }
  for (const c of candidates) {
    if (isIpAddress(c)) {
      /* skip — IP breaks Postfix virtual alias expansion */
    }
  }
  try {
    const { stdout } = await exec("hostname", ["-f"], { timeout: 5000 });
    const h = stdout.trim();
    if (isMailFqdn(h)) return h;
  } catch {
    /* */
  }
  return "mail.example.com";
}

export async function resolveOriginIp() {
  await loadEnvLocal();
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

/** MX presets for common external mail hosts (DNS at Cloudflare etc.). */
export const EXTERNAL_MAIL_PROVIDERS = [
  {
    id: "google",
    name: "Google Workspace",
    setupUrl: "https://admin.google.com/ac/domains/manage",
    steps: [
      "Add and verify your domain in Google Admin (Domains).",
      "Copy the MX records Google shows — they override mail on this VPS.",
      "Remove old MX records that point to this server when switching fully to Google.",
      "Add Google's domain verification TXT record if asked.",
    ],
    mx: [
      { priority: 1, host: "ASPMX.L.GOOGLE.COM." },
      { priority: 5, host: "ALT1.ASPMX.L.GOOGLE.COM." },
      { priority: 5, host: "ALT2.ASPMX.L.GOOGLE.COM." },
      { priority: 10, host: "ALT3.ASPMX.L.GOOGLE.COM." },
      { priority: 10, host: "ALT4.ASPMX.L.GOOGLE.COM." },
    ],
  },
  {
    id: "microsoft",
    name: "Microsoft 365",
    setupUrl: "https://admin.microsoft.com/#/Domains",
    steps: [
      "Add the domain in Microsoft 365 admin center and verify ownership (TXT).",
      "Apply the MX record Microsoft provides (often *.mail.protection.outlook.com).",
      "Complete autodiscover/CNAME steps if shown in the wizard.",
      "Remove MX to this VPS when mail is fully on Microsoft.",
    ],
    mx: [
      {
        priority: 0,
        host: "YOUR-TENANT.mail.protection.outlook.com.",
        note: "Replace with the exact host from the Microsoft 365 setup wizard.",
      },
    ],
  },
  {
    id: "zoho",
    name: "Zoho Mail",
    setupUrl: "https://www.zoho.com/mail/help/adminconsole/domain-verification.html",
    steps: [
      "Add the domain in Zoho Mail admin and verify via TXT/MX.",
      "Use the MX values Zoho assigns (mx.zoho.eu / mx.zoho.com depending on region).",
    ],
    mx: [
      {
        priority: 10,
        host: "mx.zoho.com.",
        note: "Use mx.zoho.eu for EU accounts — check Zoho admin.",
      },
    ],
  },
  {
    id: "other",
    name: "Other provider",
    steps: [
      "In your provider's admin, add the domain and note their required MX/TXT records.",
      "At your DNS host (Cloudflare, etc.), set MX to the provider — not this VPS.",
      "Keep only one active MX target; conflicting MX causes lost mail.",
      "Website can stay on this server; only mail DNS moves to the provider.",
    ],
    mx: [],
  },
];

/** DNS records users need for inbound mail on this VPS (Qadbak/Postfix). */
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
      {
        type: "TXT",
        name: "_dmarc",
        value: `v=DMARC1; p=none; rua=mailto:dmarc@${d}; fo=1`,
        note: "DMARC (start with p=none, tighten later)",
      },
    ],
    ports: "Inbound SMTP: TCP 25 · Submission: 587 · IMAP: 993 (TLS)",
    externalProviders: EXTERNAL_MAIL_PROVIDERS,
    onThisServer: {
      imap: `${mailHost}`,
      smtp: `${mailHost}`,
      note: "Use the mailbox password from Mail → Accounts. Host is often mail.yourdomain.com or the server hostname.",
    },
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
