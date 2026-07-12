#!/usr/bin/env node
/** Print Cloudflare mail DNS (DNS-only) for one or more domains. */
import { readFile } from "node:fs/promises";
import { mailDnsHints, resolveOriginIp, resolveMailHost } from "./mail-dns.mjs";

const domains = process.argv.slice(2).filter(Boolean);
if (domains.length === 0) {
  console.error("Usage: node print-cloudflare-mail-dns.mjs domain [domain...]");
  process.exit(1);
}

async function dkimTxt(domain) {
  const paths = [
    `/etc/opendkim/keys/${domain}/mail.txt`,
    `/etc/opendkim/keys/${domain}/default.txt`,
  ];
  for (const p of paths) {
    try {
      const raw = await readFile(p, "utf8");
      const m = raw.match(/"\s*([^"]+)\s*"/);
      if (m) return m[1].replace(/\s+/g, "");
    } catch {
      /* */
    }
  }
  return null;
}

const ip = await resolveOriginIp();
const mailHost = await resolveMailHost();

console.log("");
console.log("=".repeat(72));
console.log(" Cloudflare mail DNS — set Proxy to DNS only (grey cloud)");
console.log("=".repeat(72));
console.log(` Mail server hostname : ${mailHost}`);
console.log(` VPS public IPv4        : ${ip || "(unknown)"}`);
console.log("");

for (const domain of domains) {
  const hints = await mailDnsHints(domain);
  const dkim = await dkimTxt(domain);

  console.log("-".repeat(72));
  console.log(` Domain: ${domain}`);
  console.log("-".repeat(72));

  for (const r of hints.records) {
    const pri = r.priority ? `  Pri: ${r.priority}` : "";
    console.log(`  ${r.type.padEnd(4)}  Name: ${r.name}${pri}`);
    console.log(`        Value: ${r.value}`);
    if (r.note) console.log(`        Note: ${r.note}`);
    console.log("");
  }

  if (dkim) {
    console.log(`  TXT   Name: mail._domainkey`);
    console.log(`        Value: "${dkim}"`);
    console.log(`        Note: DKIM (after apply-domain-mail-security.sh)`);
    console.log("");
  } else {
    console.log(
      `  (no DKIM key yet — run: sudo bash scripts/apply-domain-mail-security.sh ${domain})`,
    );
    console.log("");
  }
}

console.log(" Ports on VPS: TCP 25 (SMTP), 587 (submission), 993 (IMAPS)");
console.log(" Webmail: Panel → Domains →", domains[0], "→ Mail → Open webmail");
console.log("=".repeat(72));
