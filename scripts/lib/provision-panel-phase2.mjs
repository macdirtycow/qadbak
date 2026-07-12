import { execFile } from "node:child_process";
import { readFile, appendFile } from "node:fs/promises";
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

function domainConfigDir(domain) {
  return path.join(QADBAK_DIR, "data", "domain-config", String(domain).toLowerCase());
}
import { mailSendDirect } from "./mail-send.mjs";
import {
  assertGitBranch,
  assertGitRepoUrl,
} from "./validate-git-deploy.mjs";

const exec = promisify(execFile);

async function runAsUser(user, file, args, opts = {}) {
  await exec("sudo", ["-u", user, file, ...args], opts);
}

async function gitDeployRunAsUser(user, pub, repoUrl, branch) {
  const git = (subArgs, extra = {}) =>
    runAsUser(user, "git", ["-C", pub, ...subArgs], { timeout: 120_000, ...extra });

  await runAsUser(user, "mkdir", ["-p", pub], { timeout: 10_000 });
  try {
    await git(["rev-parse", "--git-dir"]);
  } catch {
    await git(["init"]);
  }
  try {
    await git(["remote", "remove", "origin"]);
  } catch {
    /* no origin yet */
  }
  await git(["remote", "add", "origin", repoUrl]);
  await git(["fetch", "origin", branch]);
  try {
    await git(["checkout", "-B", branch, `origin/${branch}`]);
  } catch {
    await git(["pull", "origin", branch]);
  }
}

export async function analyticsSummary(domain) {
  const { home } = await resolveDomainUser(domain);
  const candidates = [
    `/var/log/nginx/access.log`,
    `/var/log/apache2/domains/${domain}.access_log`,
    `${home}/logs/access.log`,
  ];
  let hits = 0;
  const pages = new Map();
  const referrers = new Map();
  for (const file of candidates) {
    if (!(await fileExists(file))) continue;
    try {
      const text = await readFile(file, "utf8");
      const lines = text.split("\n").filter((l) => l.includes(domain) || file.includes(domain));
      for (const line of lines.slice(-5000)) {
        hits++;
        const m = line.match(/"(?:GET|POST|HEAD) ([^ ]+)/);
        const path = m?.[1] ?? "/";
        pages.set(path, (pages.get(path) ?? 0) + 1);
        const ref = line.match(/"([^"]*)" "[^"]*"$/);
        if (ref?.[1] && ref[1] !== "-") {
          referrers.set(ref[1], (referrers.get(ref[1]) ?? 0) + 1);
        }
      }
      break;
    } catch {
      /* */
    }
  }
  const topPages = [...pages.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([path, count]) => ({ path, count }));
  const topReferrers = [...referrers.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([ref, count]) => ({ ref, count }));
  emit({ ok: true, hits, topPages, topReferrers, period: "last log window" });
}

export async function gitDeployGet(domain) {
  const cfg = await readDomainConfigJson(domain, "git-deploy.json", {
    repoUrl: "",
    branch: "main",
    lastDeploy: null,
    webhookSecret: "",
  });
  emit({ ok: true, config: cfg });
}

export async function gitDeploySet(domain, payloadJson) {
  const payload = typeof payloadJson === "string" ? JSON.parse(payloadJson) : payloadJson;
  const cfg = {
    repoUrl: assertGitRepoUrl(String(payload.repoUrl || "").trim()),
    branch: assertGitBranch(String(payload.branch || "main").trim() || "main"),
    webhookSecret: String(payload.webhookSecret || "").trim(),
    lastDeploy: payload.lastDeploy ?? null,
  };
  await writeDomainConfigJson(domain, "git-deploy.json", cfg);
  emit({ ok: true, config: cfg });
}

export async function gitDeployRun(domain) {
  const { home, user } = await resolveDomainUser(domain);
  const cfg = await readDomainConfigJson(domain, "git-deploy.json", {});
  const pub = `${home}/public_html`;
  if (!cfg.repoUrl) fail("Configure a Git repository URL first");
  const repoUrl = assertGitRepoUrl(cfg.repoUrl);
  const branch = assertGitBranch(cfg.branch || "main");
  await gitDeployRunAsUser(user, pub, repoUrl, branch);
  cfg.lastDeploy = new Date().toISOString();
  await writeDomainConfigJson(domain, "git-deploy.json", cfg);
  const logPath = path.join(domainConfigDir(domain), "git-deploy-log.jsonl");
  await appendFile(
    logPath,
    `${JSON.stringify({ at: cfg.lastDeploy, action: "deploy", branch: cfg.branch })}\n`,
  );
  emit({ ok: true, lastDeploy: cfg.lastDeploy });
}

export async function wpToolkitStatus(domain) {
  const { home } = await resolveDomainUser(domain);
  const pub = `${home}/public_html`;
  const wpConfig = `${pub}/wp-config.php`;
  if (!(await fileExists(wpConfig))) {
    emit({ ok: true, installed: false });
    return;
  }
  let version = "";
  try {
    const { stdout } = await exec("grep", ["WP_VERSION", `${pub}/wp-includes/version.php`], {
      timeout: 5000,
    });
    version = stdout.match(/'([^']+)'/)?.[1] ?? "";
  } catch {
    /* */
  }
  emit({ ok: true, installed: true, version, path: pub });
}

export async function wpToolkitUpdate(domain) {
  const { home, user } = await resolveDomainUser(domain);
  const pub = `${home}/public_html`;
  if (!(await fileExists(`${pub}/wp-config.php`))) fail("WordPress not found in public_html");
  await exec(
    "sudo",
    ["-u", user, "bash", "-c", `cd ${pub} && wp core update --allow-root 2>/dev/null || wp core update`],
    { timeout: 180_000 },
  ).catch((e) => fail(e instanceof Error ? e.message : String(e)));
  emit({ ok: true, updatedAt: new Date().toISOString() });
}

export async function maintenanceGet(domain) {
  const cfg = await readDomainConfigJson(domain, "maintenance.json", {
    enabled: false,
    message: "We'll be back soon.",
  });
  emit({ ok: true, config: cfg });
}

export async function maintenanceSet(domain, payloadJson) {
  const payload = typeof payloadJson === "string" ? JSON.parse(payloadJson) : payloadJson;
  const { home } = await resolveDomainUser(domain);
  const cfg = {
    enabled: Boolean(payload.enabled),
    message: String(payload.message || "We'll be back soon."),
  };
  await writeDomainConfigJson(domain, "maintenance.json", cfg);
  const flag = `${home}/public_html/.maintenance`;
  if (cfg.enabled) {
    await exec("bash", ["-c", `echo '${cfg.message.replace(/'/g, "'\\''")}' > ${flag}`]);
  } else {
    await exec("rm", ["-f", flag]).catch(() => {});
  }
  emit({ ok: true, config: cfg });
}

export async function contactFormGet(domain) {
  const cfg = await readDomainConfigJson(domain, "contact-form.json", {
    enabled: true,
    listId: "",
    notifyMailbox: "info",
    subject: "Website contact form",
  });
  if (!cfg.listId) {
    cfg.listId = `cf_${domain.replace(/\./g, "_")}`;
    await writeDomainConfigJson(domain, "contact-form.json", cfg);
  }
  emit({ ok: true, config: cfg });
}

export async function contactFormSet(domain, payloadJson) {
  const payload = typeof payloadJson === "string" ? JSON.parse(payloadJson) : payloadJson;
  const current = await readDomainConfigJson(domain, "contact-form.json", {});
  const cfg = { ...current, ...payload };
  await writeDomainConfigJson(domain, "contact-form.json", cfg);
  emit({ ok: true, config: cfg });
}

export async function contactFormSubmit(domain, payloadJson) {
  const payload = typeof payloadJson === "string" ? JSON.parse(payloadJson) : payloadJson;
  const cfg = await readDomainConfigJson(domain, "contact-form.json", {});
  if (!cfg.enabled) fail("Contact form disabled");
  if (payload.listId !== cfg.listId) fail("Invalid form");
  const email = String(payload.email || "").trim();
  const name = String(payload.name || "").trim();
  const message = String(payload.message || "").trim();
  if (!email || !message) fail("Email and message required");
  const mailbox = String(cfg.notifyMailbox || "info").trim();
  const body = `Contact form on ${domain}\n\nFrom: ${name} <${email}>\n\n${message}`;
  await mailSendDirect(
    domain,
    mailbox,
    JSON.stringify({ to: `${mailbox}@${domain}`, subject: cfg.subject || "Contact", body }),
  );
  const log = await readDomainConfigJson(domain, "contact-form-log.jsonl", { entries: [] });
  const entries = Array.isArray(log.entries) ? log.entries : [];
  entries.push({ email, name, at: new Date().toISOString() });
  await writeDomainConfigJson(domain, "contact-form-log.json", {
    entries: entries.slice(-200),
  });
  emit({ ok: true });
}
