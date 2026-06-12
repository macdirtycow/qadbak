/**
 * Complete implementations for Site tools (internal rollout waves A–D).
 * Customer UI uses category names only — never "phase" labels.
 */
import { execFile } from "node:child_process";
import { readFile, writeFile, appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import {
  emit,
  fail,
  resolveDomainUser,
  readDomainConfigJson,
  writeDomainConfigJson,
  fileExists,
  QADBAK_DIR,
} from "./provisioning-common.mjs";
import { applyAutoresponderSieve } from "./mail-settings-apply.mjs";
import { mailDnsHints } from "./mail-dns.mjs";
const exec = promisify(execFile);

function domainConfigDir(domain) {
  return path.join(QADBAK_DIR, "data", "domain-config", String(domain).toLowerCase());
}

async function readSubscribers(domain) {
  const data = await readDomainConfigJson(domain, "newsletter-subscribers.json", {
    subscribers: [],
  });
  return data.subscribers ?? [];
}

export async function deliverabilityDashboard(domain) {
  const hints = await mailDnsHints(domain);
  const mail = await readDomainConfigJson(domain, "security.json", {
    spamEnabled: false,
    dkimEnabled: false,
  });
  const dmarc = await readDomainConfigJson(domain, "dmarc-settings.json", { policy: "none" });
  const spf = hints.records?.find((r) => r.type === "TXT" && String(r.value).includes("spf1"));
  let score = 0;
  if (spf) score += 35;
  if (mail.dkimEnabled) score += 35;
  if (dmarc.policy && dmarc.policy !== "none") score += 30;
  else if (dmarc.policy === "none") score += 15;
  emit({
    ok: true,
    score,
    grade: score >= 85 ? "A" : score >= 60 ? "B" : score >= 40 ? "C" : "D",
    spf: Boolean(spf),
    dkim: Boolean(mail.dkimEnabled),
    dmarc: dmarc.policy,
    hints,
  });
}

export async function mailboxAutoreplyApply(domain, localUser) {
  const user = String(localUser || "").trim().toLowerCase();
  const data = await readDomainConfigJson(domain, "mailbox-autoreply.json", { mailboxes: [] });
  const row = (data.mailboxes ?? []).find((m) => m.user === user);
  if (!row) fail("No autoresponder config for this mailbox");
  const { home } = await resolveDomainUser(domain);
  const mailboxHome = user === (await resolveDomainUser(domain)).user ? home : `/home/${user}`;
  try {
    await exec("test", ["-d", mailboxHome]);
  } catch {
    fail(`Mailbox home not found: ${mailboxHome}`);
  }
  const d = domain.toLowerCase();
  const sieve = await applyAutoresponderSieve(
    user,
    mailboxHome,
    `${user}@${d}`,
    Boolean(row.enabled),
    row.body,
  );
  emit({ ok: true, sieve, mailbox: user });
}

export async function bounceSuppressList(domain) {
  const data = await readDomainConfigJson(domain, "bounce-suppress.json", { emails: [] });
  emit({ ok: true, emails: data.emails ?? [] });
}

export async function bounceSuppressAdd(domain, email) {
  const e = String(email || "").trim().toLowerCase();
  if (!e.includes("@")) fail("Valid email required");
  const data = await readDomainConfigJson(domain, "bounce-suppress.json", { emails: [] });
  const emails = new Set(data.emails ?? []);
  emails.add(e);
  await writeDomainConfigJson(domain, "bounce-suppress.json", { emails: [...emails] });
  const subs = await readSubscribers(domain);
  for (const s of subs) {
    if (s.email === e && s.status === "active") {
      s.status = "unsubscribed";
      s.unsubscribedAt = new Date().toISOString();
      s.unsubscribedReason = "bounce";
    }
  }
  await writeDomainConfigJson(domain, "newsletter-subscribers.json", { subscribers: subs });
  emit({ ok: true, email: e });
}

export async function newsletterGdprExport(domain) {
  const subs = await readSubscribers(domain);
  emit({
    ok: true,
    csv: ["email,name,status,subscribedAt,source"]
      .concat(
        subs.map(
          (s) =>
            `${s.email},${(s.name || "").replace(/,/g, " ")},${s.status},${s.subscribedAt || ""},${s.source || ""}`,
        ),
      )
      .join("\n"),
    count: subs.length,
  });
}

export async function newsletterTemplatesList(domain) {
  const data = await readDomainConfigJson(domain, "newsletter-templates.json", { templates: [] });
  emit({ ok: true, templates: data.templates ?? [] });
}

export async function newsletterTemplateSave(domain, payloadJson) {
  const payload = typeof payloadJson === "string" ? JSON.parse(payloadJson) : payloadJson;
  const data = await readDomainConfigJson(domain, "newsletter-templates.json", { templates: [] });
  const templates = data.templates ?? [];
  const id = payload.id || `tpl_${Date.now()}`;
  const row = {
    id,
    name: String(payload.name || "Template"),
    subject: String(payload.subject || ""),
    bodyHtml: String(payload.bodyHtml || ""),
    bodyText: String(payload.bodyText || ""),
  };
  const hit = templates.findIndex((t) => t.id === id);
  if (hit >= 0) templates[hit] = row;
  else templates.push(row);
  await writeDomainConfigJson(domain, "newsletter-templates.json", { templates });
  emit({ ok: true, template: row });
}

export async function newsletterSegmentsList(domain) {
  const data = await readDomainConfigJson(domain, "newsletter-segments.json", { segments: [] });
  emit({ ok: true, segments: data.segments ?? [] });
}

export async function newsletterSegmentSave(domain, payloadJson) {
  const payload = typeof payloadJson === "string" ? JSON.parse(payloadJson) : payloadJson;
  const data = await readDomainConfigJson(domain, "newsletter-segments.json", { segments: [] });
  const segments = data.segments ?? [];
  const id = payload.id || `seg_${Date.now()}`;
  const row = {
    id,
    name: String(payload.name || "Segment"),
    filter: String(payload.filter || "active"),
  };
  const hit = segments.findIndex((s) => s.id === id);
  if (hit >= 0) segments[hit] = row;
  else segments.push(row);
  await writeDomainConfigJson(domain, "newsletter-segments.json", { segments });
  emit({ ok: true, segment: row });
}

export async function analyticsHistory(domain) {
  let hits = 0;
  const log = "/var/log/nginx/access.log";
  try {
    const text = await readFile(log, "utf8");
    hits = text.split("\n").filter((l) => l.includes(domain)).length;
  } catch {
    /* */
  }
  const hist = await readDomainConfigJson(domain, "analytics-history.json", { points: [] });
  const points = hist.points ?? [];
  points.push({ at: new Date().toISOString().slice(0, 10), hits });
  const deduped = points.filter(
    (p, i, arr) => arr.findIndex((x) => x.at === p.at) === i,
  ).slice(-90);
  await writeDomainConfigJson(domain, "analytics-history.json", { points: deduped });
  emit({ ok: true, points: deduped, today: hits });
}

export async function gitDeployLogGet(domain) {
  const p = path.join(QADBAK_DIR, "data", "domain-config", domain.toLowerCase(), "git-deploy-log.jsonl");
  let lines = [];
  try {
    const raw = await readFile(p, "utf8");
    lines = raw
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l))
      .slice(-30);
  } catch {
    /* */
  }
  emit({ ok: true, log: lines });
}

export async function gitDeployRollback(domain) {
  const { home, user } = await resolveDomainUser(domain);
  const pub = `${home}/public_html`;
  await exec("sudo", ["-u", user, "bash", "-c", `cd ${pub} && git reset --hard HEAD~1`], {
    timeout: 120_000,
  });
  await appendFile(
    path.join(domainConfigDir(domain), "git-deploy-log.jsonl"),
    `${JSON.stringify({ at: new Date().toISOString(), action: "rollback" })}\n`,
  );
  emit({ ok: true });
}

export async function wpToolkitPlugins(domain) {
  const { home, user } = await resolveDomainUser(domain);
  const pub = `${home}/public_html`;
  if (!(await fileExists(`${pub}/wp-config.php`))) fail("WordPress not found");
  await exec(
    "sudo",
    ["-u", user, "bash", "-c", `cd ${pub} && wp plugin update --all --allow-root 2>/dev/null || wp plugin update --all`],
    { timeout: 300_000 },
  );
  emit({ ok: true, updatedAt: new Date().toISOString() });
}

export async function wpToolkitSecurity(domain) {
  const { home } = await resolveDomainUser(domain);
  const pub = `${home}/public_html`;
  const issues = [];
  if (await fileExists(`${pub}/wp-config.php`)) {
    const cfg = await readFile(`${pub}/wp-config.php`, "utf8");
    if (/define\s*\(\s*['"]WP_DEBUG['"]\s*,\s*true/i.test(cfg)) issues.push("WP_DEBUG is enabled");
    if (await fileExists(`${pub}/readme.html`)) issues.push("readme.html exposed — remove after install");
    if (await fileExists(`${pub}/xmlrpc.php`)) issues.push("xmlrpc.php present — consider blocking");
  } else issues.push("WordPress not installed");
  emit({ ok: true, issues, secure: issues.length === 0 });
}

export async function wpToolkitBackup(domain) {
  const { domain: d } = await resolveDomainUser(domain);
  const { backupCreate } = await import("./provision-backup.mjs");
  const chunks = [];
  const orig = process.stdout.write.bind(process.stdout);
  process.stdout.write = (s) => {
    chunks.push(s);
    return true;
  };
  try {
    await backupCreate(d, "website");
  } finally {
    process.stdout.write = orig;
  }
  emit({ ok: true, message: "Website backup started before WordPress changes." });
}

export async function maintenanceNginx(domain, payloadJson) {
  const payload = typeof payloadJson === "string" ? JSON.parse(payloadJson) : payloadJson;
  const enabled = Boolean(payload.enabled);
  const message = String(payload.message || "Maintenance");
  const snippet = `/etc/nginx/snippets/qadbak-maint-${domain.replace(/\./g, "_")}.conf`;
  if (enabled) {
    const html = `<!DOCTYPE html><html><body><h1>${message.replace(/</g, "&lt;")}</h1></body></html>`;
    const { home } = await resolveDomainUser(domain);
    await writeFile(`${home}/public_html/.maintenance-nginx.html`, html, "utf8");
    await writeFile(
      snippet,
      `location / { return 503; }\nerror_page 503 /maintenance.html;\nlocation = /maintenance.html { root ${home}/public_html; try_files /.maintenance-nginx.html =503; }\n`,
      "utf8",
    );
  } else {
    await exec("rm", ["-f", snippet]).catch(() => {});
  }
  try {
    await exec("nginx", ["-t"]);
    await exec("systemctl", ["reload", "nginx"]);
  } catch {
    /* */
  }
  emit({ ok: true, enabled, snippet });
}

export async function contactFormEmbed(domain) {
  const cfg = await readDomainConfigJson(domain, "contact-form.json", {});
  const base = process.env.QADBAK_PUBLIC_HOST
    ? `https://${process.env.QADBAK_PUBLIC_HOST}`
    : "";
  const snippet = `<form id="qb-contact"><input name="email" type="email" required placeholder="Email"/><textarea name="message" required placeholder="Message"></textarea><button type="submit">Send</button></form><script>document.getElementById("qb-contact").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);await fetch("${base}/api/contact/submit",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({domain:"${domain}",listId:"${cfg.listId}",email:f.get("email"),message:f.get("message")})});alert("Sent!");};</script>`;
  emit({ ok: true, snippet, listId: cfg.listId });
}

export async function stagingPromote(domain) {
  const { home, user } = await resolveDomainUser(domain);
  const staging = `${home}/staging/public_html`;
  const pub = `${home}/public_html`;
  await exec(
    "sudo",
    ["-u", user, "bash", "-c", `rsync -a ${staging}/ ${pub}/`],
    { timeout: 300_000 },
  );
  emit({ ok: true, promotedAt: new Date().toISOString() });
}

export async function stagingVhost(domain) {
  const d = domain.toLowerCase();
  const sub = `staging.${d}`;
  const script = path.join(QADBAK_DIR, "scripts", "apply-domain-nginx.sh");
  const { user } = await resolveDomainUser(domain);
  if (await fileExists(script)) {
    await exec("bash", [script, sub, user], { timeout: 60_000 }).catch(() => {});
  }
  const cfg = await readDomainConfigJson(domain, "staging.json", {});
  cfg.subdomain = sub;
  cfg.vhostApplied = true;
  await writeDomainConfigJson(domain, "staging.json", cfg);
  emit({ ok: true, url: `https://${sub}`, subdomain: sub });
}

export async function bandwidthTraffic(domain) {
  const { home } = await resolveDomainUser(domain);
  let bytes = 0;
  const log = "/var/log/nginx/access.log";
  try {
    const text = await readFile(log, "utf8");
    for (const line of text.split("\n")) {
      if (!line.includes(domain)) continue;
      const m = line.match(/\s(\d+)\s(\d+)\s"[^"]*"\s"[^"]*"\s"[^"]*"\s*$/);
      if (m) bytes += parseInt(m[2], 10) || 0;
    }
  } catch {
    /* */
  }
  const hist = await readDomainConfigJson(domain, "traffic-history.json", { points: [] });
  const points = hist.points ?? [];
  points.push({ at: new Date().toISOString().slice(0, 10), bytes });
  const deduped = points.filter((p, i, arr) => arr.findIndex((x) => x.at === p.at) === i).slice(-60);
  await writeDomainConfigJson(domain, "traffic-history.json", { points: deduped });
  emit({ ok: true, bytes, points: deduped, home });
}

export async function memcachedGet(domain) {
  const cfg = await readDomainConfigJson(domain, "memcached.json", { enabled: false, prefix: "" });
  emit({ ok: true, config: cfg, host: "127.0.0.1:11211" });
}

export async function memcachedSet(domain, payloadJson) {
  const payload = typeof payloadJson === "string" ? JSON.parse(payloadJson) : payloadJson;
  await writeDomainConfigJson(domain, "memcached.json", {
    enabled: Boolean(payload.enabled),
    prefix: String(payload.prefix || domain.replace(/\./g, "_")),
  });
  emit({ ok: true });
}

export async function mongoCreate(domain, name, pass) {
  const { user } = await resolveDomainUser(domain);
  const dbName = `${user}_${name}`.replace(/-/g, "_").slice(0, 48);
  await exec("mongosh", ["--quiet", "--eval", `db.getSiblingDB('${dbName}').createCollection('init')`], {
    timeout: 30_000,
  }).catch(() => fail("MongoDB not installed or not running"));
  emit({ ok: true, name: dbName, type: "mongodb" });
}

export async function awstatsRun(domain) {
  const cfg = await readDomainConfigJson(domain, "awstats.json", { enabled: true });
  const conf = `/etc/awstats/awstats.${domain}.conf`;
  try {
    await exec("awstats", ["-config=${domain}", "-update"], { timeout: 120_000 });
    emit({ ok: true, report: `file://${conf}`, updated: true });
  } catch {
    emit({ ok: true, updated: false, hint: "Install awstats and place config at " + conf });
  }
}

export async function subdomainAdd(domain, payloadJson) {
  const payload = typeof payloadJson === "string" ? JSON.parse(payloadJson) : payloadJson;
  const sub = String(payload.sub || "www").trim();
  const { dnsAdd } = await import("./provision-dns.mjs");
  const ip = process.env.QADBAK_ORIGIN_IP || "";
  if (ip) await dnsAdd(domain, { name: sub, type: "A", value: ip }).catch(() => {});
  const { home, user } = await resolveDomainUser(domain);
  const target = `${home}/public_html/${sub}`;
  await mkdir(target, { recursive: true });
  await exec("chown", ["-R", `${user}:${user}`, target]).catch(() => {});
  emit({ ok: true, subdomain: `${sub}.${domain}`, path: target });
}

export async function seo404Scan(domain) {
  const log = "/var/log/nginx/access.log";
  const paths = new Map();
  try {
    const text = await readFile(log, "utf8");
    for (const line of text.split("\n")) {
      if (!line.includes(domain) || !line.includes(' 404 ')) continue;
      const m = line.match(/"(?:GET|POST) ([^ ]+)/);
      if (m) paths.set(m[1], (paths.get(m[1]) ?? 0) + 1);
    }
  } catch {
    /* */
  }
  const top = [...paths.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([path, count]) => ({ path, count }));
  emit({ ok: true, notFound: top });
}

export async function woocommerceStatus(domain) {
  const { home } = await resolveDomainUser(domain);
  const pub = `${home}/public_html`;
  const installed = await fileExists(`${pub}/wp-content/plugins/woocommerce/woocommerce.php`);
  emit({ ok: true, installed, shopUrl: installed ? `https://${domain}/shop` : null });
}

export async function ciPipelineGet(domain) {
  const cfg = await readDomainConfigJson(domain, "ci-pipeline.json", {
    enabled: false,
    steps: ["git pull", "npm ci", "npm run build"],
  });
  emit({ ok: true, config: cfg });
}

export async function ciPipelineSet(domain, payloadJson) {
  const payload = typeof payloadJson === "string" ? JSON.parse(payloadJson) : payloadJson;
  await writeDomainConfigJson(domain, "ci-pipeline.json", payload);
  emit({ ok: true, config: payload });
}

export async function ciPipelineRun(domain) {
  const { home, user } = await resolveDomainUser(domain);
  const cfg = await readDomainConfigJson(domain, "ci-pipeline.json", { steps: [] });
  const pub = `${home}/public_html`;
  for (const step of cfg.steps ?? []) {
    await exec("sudo", ["-u", user, "bash", "-c", `cd ${pub} && ${step}`], {
      timeout: 600_000,
    });
  }
  emit({ ok: true, ran: cfg.steps?.length ?? 0 });
}

export async function ticketNotify(domain, payloadJson) {
  const payload = typeof payloadJson === "string" ? JSON.parse(payloadJson) : payloadJson;
  const { mailSendDirect } = await import("./mail-send.mjs");
  const mailbox = String(payload.mailbox || "info").trim();
  await mailSendDirect(
    domain,
    mailbox,
    JSON.stringify({
      to: `${mailbox}@${domain}`,
      subject: `New ticket: ${payload.subject}`,
      body: String(payload.body || ""),
    }),
  );
  emit({ ok: true });
}

export async function invoiceMarkSent(domain, invoiceId) {
  const data = await readDomainConfigJson(domain, "billing-invoices.json", { invoices: [] });
  const inv = (data.invoices ?? []).find((i) => i.id === invoiceId);
  if (!inv) fail("Invoice not found");
  inv.status = "sent";
  inv.sentAt = new Date().toISOString();
  await writeDomainConfigJson(domain, "billing-invoices.json", data);
  emit({ ok: true, invoice: inv });
}

export async function carddavExportVcf(domain) {
  const data = await readDomainConfigJson(domain, "carddav-contacts.json", { contacts: [] });
  const vcf = (data.contacts ?? [])
    .map(
      (c) =>
        `BEGIN:VCARD\nVERSION:3.0\nFN:${c.name || c.email}\nEMAIL:${c.email}\nEND:VCARD`,
    )
    .join("\n");
  emit({ ok: true, vcf, count: data.contacts?.length ?? 0 });
}

export async function nodesPingHealth() {
  const data = await readDomainConfigJson("_global", "cluster-nodes.json", { nodes: [] });
  const nodes = [];
  for (const n of data.nodes ?? []) {
    let status = "down";
    try {
      await exec("curl", ["-fsS", "--max-time", "5", `https://${n.host}/api/health`], {
        timeout: 8000,
      });
      status = "up";
    } catch {
      /* */
    }
    nodes.push({ ...n, status, checkedAt: new Date().toISOString() });
  }
  await writeDomainConfigJson("_global", "cluster-nodes.json", { nodes });
  emit({ ok: true, nodes });
}

export async function panelPolicyGet() {
  const policy = await readDomainConfigJson("_global", "panel-policy.json", {
    requireClientTotp: false,
  });
  emit({ ok: true, policy });
}

export async function panelPolicySet(payloadJson) {
  const payload = typeof payloadJson === "string" ? JSON.parse(payloadJson) : payloadJson;
  await writeDomainConfigJson("_global", "panel-policy.json", {
    requireClientTotp: Boolean(payload.requireClientTotp),
  });
  emit({ ok: true, policy: payload });
}
