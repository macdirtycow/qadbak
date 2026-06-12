import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  emit,
  fail,
  resolveDomainUser,
  readDomainConfigJson,
  writeDomainConfigJson,
} from "./provisioning-common.mjs";
import { mailDnsHints } from "./mail-dns.mjs";
import { dnsAdd } from "./provision-dns.mjs";

const exec = promisify(execFile);
const MAILBOX_SETTINGS = "mailbox-autoreply.json";
const BOUNCES_FILE = "mail-bounces.jsonl";

export async function dmarcGet(domain) {
  const hints = await mailDnsHints(domain);
  const settings = await readDomainConfigJson(domain, "dmarc-settings.json", {
    policy: "none",
    rua: "",
    applyDns: false,
  });
  const d = String(domain).trim().toLowerCase();
  const rua = settings.rua || `mailto:dmarc@${d}`;
  const record = `v=DMARC1; p=${settings.policy}; rua=${rua}; fo=1`;
  emit({
    ok: true,
    settings,
    suggestedRecord: record,
    dnsName: "_dmarc",
    hints,
  });
}

export async function dmarcSet(domain, payloadJson) {
  let payload = typeof payloadJson === "string" ? JSON.parse(payloadJson) : payloadJson;
  const policy = ["none", "quarantine", "reject"].includes(payload.policy)
    ? payload.policy
    : "none";
  const settings = {
    policy,
    rua: String(payload.rua || "").trim(),
    applyDns: Boolean(payload.applyDns),
  };
  await writeDomainConfigJson(domain, "dmarc-settings.json", settings);
  if (settings.applyDns) {
    const d = String(domain).trim().toLowerCase();
    const rua = settings.rua || `mailto:dmarc@${d}`;
    const value = `v=DMARC1; p=${policy}; rua=${rua}; fo=1`;
    try {
      await dnsAdd(domain, { name: "_dmarc", type: "TXT", value });
    } catch {
      /* external DNS */
    }
  }
  emit({ ok: true, settings });
}

export async function mailboxAutoreplyList(domain) {
  const data = await readDomainConfigJson(domain, MAILBOX_SETTINGS, { mailboxes: [] });
  emit({ ok: true, mailboxes: data.mailboxes ?? [] });
}

export async function mailboxAutoreplySet(domain, payloadJson) {
  let payload = typeof payloadJson === "string" ? JSON.parse(payloadJson) : payloadJson;
  const user = String(payload.user || "").trim().toLowerCase();
  if (!user) fail("Mailbox user required");
  const data = await readDomainConfigJson(domain, MAILBOX_SETTINGS, { mailboxes: [] });
  const mailboxes = Array.isArray(data.mailboxes) ? data.mailboxes : [];
  const hit = mailboxes.find((m) => m.user === user);
  const row = {
    user,
    enabled: Boolean(payload.enabled),
    subject: String(payload.subject || "Out of office"),
    body: String(payload.body || ""),
    updatedAt: new Date().toISOString(),
  };
  if (hit) Object.assign(hit, row);
  else mailboxes.push(row);
  await writeDomainConfigJson(domain, MAILBOX_SETTINGS, { mailboxes });
  const { applyAutoresponderSieve } = await import("./mail-settings-apply.mjs");
  const { user: owner, home } = await resolveDomainUser(domain);
  const mailboxHome = user === owner ? home : `/home/${user}`;
  let sieve = { applied: false };
  try {
    sieve = await applyAutoresponderSieve(
      user,
      mailboxHome,
      `${user}@${domain.toLowerCase()}`,
      Boolean(row.enabled),
      row.body,
    );
  } catch {
    /* */
  }
  emit({ ok: true, mailbox: row, sieve });
}

export async function mailBouncesList(domain) {
  const { home } = await resolveDomainUser(domain);
  const stored = await readDomainConfigJson(domain, "mail-bounces-index.json", { bounces: [] });
  let bounces = stored.bounces ?? [];
  try {
    const { stdout } = await exec(
      "bash",
      [
        "-c",
        `grep -h "status=bounced\\|status=deferred" /var/log/mail.log 2>/dev/null | grep -i "${domain}" | tail -80 || true`,
      ],
      { maxBuffer: 2 * 1024 * 1024 },
    );
    const lines = stdout.split("\n").filter(Boolean);
    const parsed = lines.map((line) => ({
      line: line.slice(0, 240),
      at: new Date().toISOString(),
      source: "mail.log",
    }));
    bounces = [...parsed, ...bounces].slice(0, 100);
  } catch {
    /* */
  }
  emit({ ok: true, bounces, home });
}

export async function newsletterTrackRecord(domain, payloadJson) {
  const payload = typeof payloadJson === "string" ? JSON.parse(payloadJson) : payloadJson;
  const kind = payload.kind === "click" ? "click" : "open";
  const tracking = await readDomainConfigJson(domain, "newsletter-tracking.json", {
    opens: 0,
    clicks: 0,
    events: [],
  });
  if (kind === "click") tracking.clicks = (tracking.clicks ?? 0) + 1;
  else tracking.opens = (tracking.opens ?? 0) + 1;
  tracking.events = [
    ...(tracking.events ?? []),
    {
      kind,
      campaignId: payload.campaignId,
      email: payload.email,
      at: new Date().toISOString(),
    },
  ].slice(-500);
  await writeDomainConfigJson(domain, "newsletter-tracking.json", tracking);
  if (payload.campaignId) {
    const campaigns = await readDomainConfigJson(domain, "newsletter-campaigns.json", {
      campaigns: [],
    });
    const c = (campaigns.campaigns ?? []).find((x) => x.id === payload.campaignId);
    if (c) {
      c.tracking = c.tracking ?? { opens: 0, clicks: 0 };
      if (kind === "click") c.tracking.clicks++;
      else c.tracking.opens++;
      await writeDomainConfigJson(domain, "newsletter-campaigns.json", campaigns);
    }
  }
  emit({ ok: true });
}

export async function newsletterStatsGet(domain) {
  const campaigns = await readDomainConfigJson(domain, "newsletter-campaigns.json", {
    campaigns: [],
  });
  const tracking = await readDomainConfigJson(domain, "newsletter-tracking.json", {
    opens: 0,
    clicks: 0,
    events: [],
  });
  emit({
    ok: true,
    totals: { opens: tracking.opens ?? 0, clicks: tracking.clicks ?? 0 },
    events: (tracking.events ?? []).slice(-50),
    campaigns: (campaigns.campaigns ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      stats: c.stats,
      tracking: c.tracking ?? { opens: 0, clicks: 0 },
    })),
  });
}
