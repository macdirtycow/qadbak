import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, access } from "node:fs/promises";
import path from "node:path";
import { emit, fail, resolveDomainUser } from "./provisioning-common.mjs";

const exec = promisify(execFile);

async function certbotList(domain) {
  const certs = [];
  const live = "/etc/letsencrypt/live";
  for (const host of [domain, `www.${domain}`]) {
    const dir = path.join(live, host);
    try {
      await access(dir);
      const fullchain = path.join(dir, "fullchain.pem");
      const pem = await readFile(fullchain, "utf8");
      const notAfter = await exec("openssl", [
        "x509",
        "-enddate",
        "-noout",
        "-in",
        fullchain,
      ]);
      certs.push({
        host,
        issuer: pem.includes("Let's Encrypt") ? "Let's Encrypt" : "unknown",
        expiry: notAfter.stdout.replace("notAfter=", "").trim(),
        type: "letsencrypt",
      });
    } catch {
      /* no cert */
    }
  }
  if (certs.length) return certs;
  try {
    const { stdout } = await exec("certbot", ["certificates"], { maxBuffer: 2 * 1024 * 1024 });
    if (stdout.includes(domain)) {
      certs.push({
        host: domain,
        issuer: "Let's Encrypt",
        expiry: "",
        type: "letsencrypt",
      });
    }
  } catch {
    /* certbot missing */
  }
  return certs;
}

export async function sslList(domain) {
  await resolveDomainUser(domain);
  const certs = await certbotList(domain);
  emit({ ok: true, certs });
}

export async function sslIssue(domain, host) {
  const { user, home } = await resolveDomainUser(domain);
  const target = host && host !== domain ? host : domain;
  const email =
    process.env.QADBAK_LE_EMAIL?.trim() ||
    process.env.LE_EMAIL?.trim() ||
    `admin@${domain}`;
  const webroot = path.join(home, "public_html");
  const args = [
    "certonly",
    "--non-interactive",
    "--agree-tos",
    "-m",
    email,
    "--keep-until-expiring",
    "-d",
    domain,
    "-d",
    `www.${domain}`,
  ];
  try {
    await exec("certbot", [...args, "--nginx"], { timeout: 300_000, maxBuffer: 4 * 1024 * 1024 });
  } catch {
    await exec(
      "certbot",
      [...args, "--webroot", "-w", webroot],
      { timeout: 300_000, maxBuffer: 4 * 1024 * 1024 },
    );
  }
  emit({ ok: true, domain, host: target, user });
}
