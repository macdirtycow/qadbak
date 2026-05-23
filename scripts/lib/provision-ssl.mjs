import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, access, readdir } from "node:fs/promises";
import path from "node:path";
import { emit, fail, resolveDomainUser } from "./provisioning-common.mjs";

const exec = promisify(execFile);

async function readCertFile(fullchain, host) {
  const pem = await readFile(fullchain, "utf8");
  const notAfter = await exec("openssl", [
    "x509",
    "-enddate",
    "-noout",
    "-in",
    fullchain,
  ]);
  return {
    host,
    issuer: pem.includes("Let's Encrypt")
      ? "Let's Encrypt"
      : pem.includes("R3") || pem.includes("E1")
        ? "Let's Encrypt"
        : "installed",
    expiry: notAfter.stdout.replace("notAfter=", "").trim(),
    type: "letsencrypt",
  };
}

async function certbotList(domain) {
  const certs = [];
  const seen = new Set();
  const live = "/etc/letsencrypt/live";
  const hosts = new Set([domain, `www.${domain}`]);
  try {
    for (const name of await readdir(live)) {
      if (name.includes(domain) || domain.includes(name.replace(/^www\./, ""))) {
        hosts.add(name);
      }
    }
  } catch {
    /* */
  }
  for (const host of hosts) {
    const dir = path.join(live, host);
    try {
      await access(dir);
      const fullchain = path.join(dir, "fullchain.pem");
      const row = await readCertFile(fullchain, host);
      if (!seen.has(row.host)) {
        seen.add(row.host);
        certs.push(row);
      }
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
