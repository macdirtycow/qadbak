#!/usr/bin/env node
/**
 * Validated stack operations (phase 5) — nginx/apache/mail/firewall without Webmin modules.
 * Usage: stack-helper.mjs <command> [args...]
 */
import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { promisify } from "node:util";

const exec = promisify(execFile);
const QADBAK_DIR = process.env.QADBAK_DIR || "/opt/qadbak";

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function runCheck(id, label, cmd, args, opts = {}) {
  try {
    const { stdout, stderr } = await exec(cmd, args, {
      timeout: opts.timeout ?? 60_000,
      maxBuffer: opts.maxBuffer ?? 2 * 1024 * 1024,
    });
    const out = [stdout, stderr].filter(Boolean).join("\n").trim();
    const ok = opts.expectOk ? opts.expectOk(out) : true;
    return { id, label, ok, detail: out.split("\n")[0]?.slice(0, 200) || "ok", output: out };
  } catch (e) {
    const out = [e.stdout, e.stderr, e.message].filter(Boolean).join("\n").trim();
    return {
      id,
      label,
      ok: false,
      detail: out.split("\n")[0]?.slice(0, 200) || "failed",
      output: out,
    };
  }
}

async function cmdValidate() {
  const checks = [];
  if (await exists("/usr/sbin/nginx")) {
    checks.push(await runCheck("nginx", "Nginx config", "nginx", ["-t"]));
  }
  if (await exists("/usr/sbin/apache2ctl")) {
    checks.push(
      await runCheck("apache", "Apache config", "apache2ctl", ["configtest"]),
    );
  } else if (await exists("/usr/sbin/apachectl")) {
    checks.push(await runCheck("apache", "Apache config", "apachectl", ["-t"]));
  }
  if (await exists("/usr/sbin/postfix")) {
    checks.push(await runCheck("postfix", "Postfix", "postfix", ["check"]));
  }
  if (await exists("/usr/bin/doveconf")) {
    checks.push(
      await runCheck("dovecot", "Dovecot", "doveconf", ["-n"], {
        expectOk: (o) => !/Error|error/i.test(o),
      }),
    );
  }
  if (await exists("/etc/bind/named.conf")) {
    checks.push(
      await runCheck("bind", "BIND", "named-checkconf", [], {
        expectOk: () => true,
      }),
    );
  }
  if (await exists("/usr/sbin/mariadbd") || (await exists("/usr/bin/mysql"))) {
    checks.push(
      await runCheck("mariadb", "MariaDB active", "systemctl", [
        "is-active",
        "mariadb",
      ], { expectOk: (o) => o.trim() === "active" }),
    );
  }
  checks.push(await cmdUfwStatusInner());
  const ok = checks.every((c) => c.ok);
  return { ok, checks };
}

async function cmdUfwStatusInner() {
  if (!(await exists("/usr/sbin/ufw"))) {
    return { id: "ufw", label: "UFW", ok: true, detail: "not installed" };
  }
  try {
    const { stdout } = await exec("ufw", ["status"], { timeout: 10_000 });
    const active = /Status:\s*active/i.test(stdout);
    return {
      id: "ufw",
      label: "UFW",
      ok: true,
      detail: active ? "active" : stdout.split("\n")[0]?.trim(),
      output: stdout,
    };
  } catch (e) {
    return {
      id: "ufw",
      label: "UFW",
      ok: false,
      detail: e.message ?? "ufw status failed",
    };
  }
}

async function cmdNginxReload() {
  await exec("systemctl", ["reload", "nginx"], { timeout: 30_000 });
  return { ok: true, action: "nginx-reload" };
}

async function cmdApacheReload() {
  const unit = (await exists("/usr/sbin/apache2ctl")) ? "apache2" : "httpd";
  await exec("systemctl", ["reload", unit], { timeout: 30_000 });
  return { ok: true, action: "apache-reload", unit };
}

async function cmdApplyNginxVhosts() {
  const script = `${QADBAK_DIR}/scripts/apply-customer-nginx-vhosts.sh`;
  if (!(await exists(script))) {
    throw new Error(`Missing ${script}`);
  }
  const { stdout, stderr } = await exec("bash", [script], {
    timeout: 180_000,
    maxBuffer: 4 * 1024 * 1024,
  });
  return {
    ok: true,
    action: "apply-nginx-vhosts",
    output: [stdout, stderr].filter(Boolean).join("\n").trim(),
  };
}

async function cmdUfwAllow(port) {
  const p = Number.parseInt(port, 10);
  if (!Number.isFinite(p) || p < 1 || p > 65535) {
    throw new Error("Invalid port");
  }
  const script = `${QADBAK_DIR}/scripts/open-host-firewall-port.sh`;
  const { stdout, stderr } = await exec("bash", [script, String(p)], {
    timeout: 60_000,
  });
  return {
    ok: true,
    action: "ufw-allow",
    port: p,
    output: [stdout, stderr].filter(Boolean).join("\n").trim(),
  };
}

async function resolveDomainUser(domain) {
  try {
    const { stdout } = await exec(
      "virtualmin",
      ["list-domains", "--domain", domain, "--multiline"],
      { timeout: 15_000 },
    );
    const m = stdout.match(/^Unix username:\s*(.+)$/m);
    if (m) return m[1].trim();
  } catch {
    /* optional */
  }
  return domain.split(".")[0];
}

async function grepInDir(dir, pattern) {
  try {
    const { stdout } = await exec(
      "grep",
      ["-rl", pattern, dir],
      { timeout: 15_000 },
    );
    return stdout.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

async function cmdDomainValidate(domain) {
  if (!/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/i.test(domain)) {
    throw new Error("Invalid domain name");
  }
  const user = await resolveDomainUser(domain);
  const pub = `/home/${user}/public_html`;
  const checks = [];

  checks.push({
    id: "public_html",
    label: "Document root",
    ok: await exists(pub),
    detail: pub,
  });

  const nginxHits = [
    ...(await grepInDir("/etc/nginx/sites-enabled", domain)),
    ...(await grepInDir("/etc/nginx/sites-available", domain)),
  ];
  checks.push({
    id: "nginx_vhost",
    label: "Nginx vhost",
    ok: nginxHits.length > 0,
    detail: nginxHits[0] || "no server_name match in nginx sites",
  });

  const apacheHits = await grepInDir("/etc/apache2/sites-enabled", `ServerName.*${domain}`);
  const apacheHits2 =
    apacheHits.length === 0
      ? await grepInDir("/etc/apache2/sites-available", `ServerName.*${domain}`)
      : [];
  const ah = [...apacheHits, ...apacheHits2];
  checks.push({
    id: "apache_vhost",
    label: "Apache vhost",
    ok: ah.length > 0,
    detail: ah[0] || "no Apache ServerName for domain",
  });

  const ok = checks.every((c) => c.ok);
  return { ok, domain, unixUser: user, checks };
}

async function main() {
  const [cmd, arg] = process.argv.slice(2);
  let result;
  switch (cmd) {
    case "validate":
      result = await cmdValidate();
      break;
    case "nginx-reload":
      result = await cmdNginxReload();
      break;
    case "apache-reload":
      result = await cmdApacheReload();
      break;
    case "apply-nginx-vhosts":
      result = await cmdApplyNginxVhosts();
      break;
    case "ufw-status":
      result = { ok: true, check: await cmdUfwStatusInner() };
      break;
    case "ufw-allow":
      result = await cmdUfwAllow(arg);
      break;
    case "domain-validate":
      if (!arg) throw new Error("domain required");
      result = await cmdDomainValidate(arg);
      break;
    case "ping":
      result = { pong: true };
      break;
    default:
      console.error(
        JSON.stringify({
          ok: false,
          error:
            "Usage: validate | nginx-reload | apache-reload | apply-nginx-vhosts | ufw-status | ufw-allow PORT | domain-validate DOMAIN",
        }),
      );
      process.exit(1);
  }
  console.log(JSON.stringify({ ok: true, ...result }));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message ?? String(err) }));
  process.exit(1);
});
