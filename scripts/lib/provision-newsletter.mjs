import { randomBytes } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import {
  emit,
  fail,
  resolveDomainUser,
  readDomainConfigJson,
  writeDomainConfigJson,
  domainConfigDir,
} from "./provisioning-common.mjs";
import { mailSendDirect } from "./mail-send.mjs";
import {
  appendUnsubscribeFooter,
  newsletterPublicUrls,
  sendNewsletterMessage,
  wrapNewsletterLinksForTracking,
} from "./newsletter-mail.mjs";

const SETTINGS_FILE = "newsletter-settings.json";
const SUBSCRIBERS_FILE = "newsletter-subscribers.json";
const CAMPAIGNS_FILE = "newsletter-campaigns.json";
const QUEUE_FILE = "newsletter-queue.jsonl";

const DEFAULT_SETTINGS = {
  enabled: true,
  fromMailbox: "info",
  fromName: "",
  doubleOptIn: true,
  signupEnabled: true,
  listId: "",
  welcomeSubject: "Confirm your subscription",
  welcomeBody:
    "Thanks for subscribing! Click the link below to confirm your email address:\n\n{confirmUrl}",
};

const BATCH_DEFAULT = 50;

function newId() {
  return randomBytes(12).toString("hex");
}

function newToken() {
  return randomBytes(18).toString("hex");
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

async function readSubscribers(domain) {
  const data = await readDomainConfigJson(domain, SUBSCRIBERS_FILE, { subscribers: [] });
  return Array.isArray(data.subscribers) ? data.subscribers : [];
}

async function writeSubscribers(domain, subscribers) {
  await writeDomainConfigJson(domain, SUBSCRIBERS_FILE, { subscribers });
}

async function readCampaigns(domain) {
  const data = await readDomainConfigJson(domain, CAMPAIGNS_FILE, { campaigns: [] });
  return Array.isArray(data.campaigns) ? data.campaigns : [];
}

async function writeCampaigns(domain, campaigns) {
  await writeDomainConfigJson(domain, CAMPAIGNS_FILE, { campaigns });
}

async function getSettings(domain) {
  await resolveDomainUser(domain);
  const settings = await readDomainConfigJson(domain, SETTINGS_FILE, DEFAULT_SETTINGS);
  if (!settings.listId) {
    settings.listId = newId();
    await writeDomainConfigJson(domain, SETTINGS_FILE, { ...DEFAULT_SETTINGS, ...settings });
  }
  return { ...DEFAULT_SETTINGS, ...settings };
}

function queuePath(domain) {
  return path.join(domainConfigDir(domain), QUEUE_FILE);
}

async function readQueueLines(domain) {
  const p = queuePath(domain);
  try {
    const raw = await readFile(p, "utf8");
    return raw
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function writeQueueLines(domain, lines) {
  const dir = domainConfigDir(domain);
  await mkdir(dir, { recursive: true });
  const p = queuePath(domain);
  const body = lines.length ? `${lines.map((l) => JSON.stringify(l)).join("\n")}\n` : "";
  await writeFile(p, body, "utf8");
}

function replaceTokens(text, vars) {
  let out = String(text ?? "");
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(String(v));
  }
  return out;
}

async function sendSystemMail(domain, mailbox, to, subject, body) {
  await mailSendDirect(
    domain,
    mailbox,
    JSON.stringify({ to, subject, body }),
  );
}

export async function newsletterGet(domain) {
  const settings = await getSettings(domain);
  const subscribers = await readSubscribers(domain);
  const campaigns = await readCampaigns(domain);
  const urls = newsletterPublicUrls(domain);
  emit({
    ok: true,
    settings,
    stats: {
      total: subscribers.length,
      active: subscribers.filter((s) => s.status === "active").length,
      pending: subscribers.filter((s) => s.status === "pending").length,
      unsubscribed: subscribers.filter((s) => s.status === "unsubscribed").length,
    },
    campaigns: campaigns.length,
    publicUrls: urls,
  });
}

export async function newsletterSet(domain, settingsJson) {
  await resolveDomainUser(domain);
  let patch = settingsJson;
  if (typeof settingsJson === "string") {
    try {
      patch = JSON.parse(settingsJson);
    } catch {
      fail("Invalid settings JSON");
    }
  }
  const current = await getSettings(domain);
  const merged = {
    ...current,
    ...patch,
    listId: current.listId || newId(),
  };
  await writeDomainConfigJson(domain, SETTINGS_FILE, merged);
  emit({ ok: true, settings: merged });
}

export async function newsletterSubscribersList(domain) {
  const subscribers = await readSubscribers(domain);
  emit({
    ok: true,
    subscribers: subscribers.map((s) => ({
      id: s.id,
      email: s.email,
      name: s.name ?? "",
      status: s.status,
      source: s.source ?? "manual",
      subscribedAt: s.subscribedAt,
      confirmedAt: s.confirmedAt,
      unsubscribedAt: s.unsubscribedAt,
    })),
  });
}

export async function newsletterSubscriberUpsert(domain, payloadJson) {
  let payload = payloadJson;
  if (typeof payloadJson === "string") {
    try {
      payload = JSON.parse(payloadJson);
    } catch {
      fail("Invalid subscriber JSON");
    }
  }
  const email = normalizeEmail(payload.email);
  if (!isValidEmail(email)) fail("Valid email required");
  const name = String(payload.name ?? "").trim();
  const source = String(payload.source ?? "manual").trim() || "manual";
  const settings = await getSettings(domain);
  const subscribers = await readSubscribers(domain);
  const existing = subscribers.find((s) => normalizeEmail(s.email) === email);

  if (existing && existing.status === "unsubscribed" && !payload.resubscribe) {
    fail("This address has unsubscribed. Use resubscribe to add again.");
  }

  const now = new Date().toISOString();
  if (existing) {
    existing.name = name || existing.name;
    if (payload.resubscribe || existing.status === "unsubscribed") {
      existing.status = settings.doubleOptIn ? "pending" : "active";
      existing.unsubscribedAt = undefined;
      existing.confirmToken = newToken();
      existing.token = newToken();
      existing.subscribedAt = now;
      existing.confirmedAt = settings.doubleOptIn ? undefined : now;
      if (settings.doubleOptIn) {
        await sendConfirmEmail(domain, settings, existing);
      }
    }
    await writeSubscribers(domain, subscribers);
    emit({ ok: true, subscriber: sanitizeSubscriber(existing), created: false });
    return;
  }

  const sub = {
    id: newId(),
    email,
    name,
    status: settings.doubleOptIn ? "pending" : "active",
    source,
    subscribedAt: now,
    confirmedAt: settings.doubleOptIn ? undefined : now,
    token: newToken(),
    confirmToken: settings.doubleOptIn ? newToken() : undefined,
  };
  subscribers.push(sub);
  await writeSubscribers(domain, subscribers);
  if (settings.doubleOptIn) {
    await sendConfirmEmail(domain, settings, sub);
  }
  emit({ ok: true, subscriber: sanitizeSubscriber(sub), created: true });
}

function sanitizeSubscriber(s) {
  return {
    id: s.id,
    email: s.email,
    name: s.name ?? "",
    status: s.status,
    source: s.source ?? "manual",
    subscribedAt: s.subscribedAt,
    confirmedAt: s.confirmedAt,
    unsubscribedAt: s.unsubscribedAt,
  };
}

async function sendConfirmEmail(domain, settings, sub) {
  const urls = newsletterPublicUrls(domain);
  const confirmUrl = `${urls.confirm}?domain=${encodeURIComponent(domain)}&token=${encodeURIComponent(sub.confirmToken)}`;
  const subject = settings.welcomeSubject || DEFAULT_SETTINGS.welcomeSubject;
  const body = replaceTokens(settings.welcomeBody || DEFAULT_SETTINGS.welcomeBody, {
    confirmUrl,
    name: sub.name || sub.email,
    email: sub.email,
  });
  const mailbox = String(settings.fromMailbox || "info").trim();
  await sendSystemMail(domain, mailbox, sub.email, subject, body);
}

export async function newsletterSubscriberDelete(domain, emailOrId) {
  const key = String(emailOrId || "").trim().toLowerCase();
  if (!key) fail("Email or id required");
  const subscribers = await readSubscribers(domain);
  const next = subscribers.filter(
    (s) => s.id !== key && normalizeEmail(s.email) !== key,
  );
  if (next.length === subscribers.length) fail("Subscriber not found");
  await writeSubscribers(domain, next);
  emit({ ok: true, removed: subscribers.length - next.length });
}

export async function newsletterSubscribersImport(domain, payloadJson) {
  let payload = payloadJson;
  if (typeof payloadJson === "string") {
    try {
      payload = JSON.parse(payloadJson);
    } catch {
      fail("Invalid import JSON");
    }
  }
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  const settings = await getSettings(domain);
  const subscribers = await readSubscribers(domain);
  const seen = new Set(subscribers.map((s) => normalizeEmail(s.email)));
  const now = new Date().toISOString();
  let added = 0;
  let skipped = 0;

  for (const row of rows) {
    const email = normalizeEmail(row.email ?? row.Email ?? row[0]);
    if (!isValidEmail(email)) {
      skipped++;
      continue;
    }
    if (seen.has(email)) {
      skipped++;
      continue;
    }
    const name = String(row.name ?? row.Name ?? row[1] ?? "").trim();
    subscribers.push({
      id: newId(),
      email,
      name,
      status: settings.doubleOptIn ? "pending" : "active",
      source: "import",
      subscribedAt: now,
      confirmedAt: settings.doubleOptIn ? undefined : now,
      token: newToken(),
      confirmToken: settings.doubleOptIn ? newToken() : undefined,
    });
    seen.add(email);
    added++;
  }
  await writeSubscribers(domain, subscribers);
  emit({ ok: true, added, skipped, total: subscribers.length });
}

export async function newsletterCampaignsList(domain) {
  const campaigns = await readCampaigns(domain);
  emit({ ok: true, campaigns });
}

export async function newsletterCampaignUpsert(domain, payloadJson) {
  let payload = payloadJson;
  if (typeof payloadJson === "string") {
    try {
      payload = JSON.parse(payloadJson);
    } catch {
      fail("Invalid campaign JSON");
    }
  }
  const campaigns = await readCampaigns(domain);
  const now = new Date().toISOString();
  const id = String(payload.id || "").trim() || newId();
  const existing = campaigns.find((c) => c.id === id);

  const campaign = {
    id,
    name: String(payload.name ?? existing?.name ?? "Untitled").trim() || "Untitled",
    subject: String(payload.subject ?? existing?.subject ?? "").trim(),
    bodyHtml: String(payload.bodyHtml ?? existing?.bodyHtml ?? "").trim(),
    bodyText: String(payload.bodyText ?? existing?.bodyText ?? "").trim(),
    status: existing?.status ?? "draft",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    sentAt: existing?.sentAt,
    stats: existing?.stats ?? { total: 0, sent: 0, failed: 0, remaining: 0 },
    sendLog: existing?.sendLog ?? [],
  };

  if (!campaign.subject) fail("Subject is required");
  if (!campaign.bodyHtml && !campaign.bodyText) fail("Message body is required");

  if (existing) {
    Object.assign(existing, campaign);
  } else {
    campaigns.push(campaign);
  }
  await writeCampaigns(domain, campaigns);
  emit({ ok: true, campaign });
}

export async function newsletterCampaignDelete(domain, campaignId) {
  const id = String(campaignId || "").trim();
  const campaigns = await readCampaigns(domain);
  const hit = campaigns.find((c) => c.id === id);
  if (!hit) fail("Campaign not found");
  if (hit.status === "sending") fail("Cannot delete a campaign that is sending");
  await writeCampaigns(
    domain,
    campaigns.filter((c) => c.id !== id),
  );
  emit({ ok: true, deleted: id });
}

export async function newsletterCampaignQueue(domain, campaignId) {
  const id = String(campaignId || "").trim();
  const settings = await getSettings(domain);
  if (!settings.enabled) fail("Newsletter is disabled for this domain");
  const campaigns = await readCampaigns(domain);
  const campaign = campaigns.find((c) => c.id === id);
  if (!campaign) fail("Campaign not found");
  if (campaign.status === "sending") fail("Campaign is already sending");
  if (campaign.status === "sent") fail("Campaign was already sent");

  const subscribers = (await readSubscribers(domain)).filter((s) => s.status === "active");
  if (subscribers.length === 0) fail("No active subscribers");

  const mailbox = String(settings.fromMailbox || "info").trim();
  const from = `${mailbox}@${domain}`;
  const urls = newsletterPublicUrls(domain);
  const lines = subscribers.map((sub) => {
    const unsubUrl = `${urls.unsubscribe}?domain=${encodeURIComponent(domain)}&token=${encodeURIComponent(sub.token)}`;
    const withFooter = appendUnsubscribeFooter(
      campaign.bodyHtml || campaign.bodyText.replace(/\n/g, "<br>"),
      campaign.bodyText || campaign.bodyHtml,
      unsubUrl,
    );
    const trackBase = `${urls.subscribe.replace("/subscribe", "/track")}`;
    const trackedHtml = wrapNewsletterLinksForTracking(withFooter.html, {
      trackBase,
      domain,
      campaignId: id,
      email: sub.email,
    });
    const pixel = `<img src="${trackBase}?domain=${encodeURIComponent(domain)}&kind=open&c=${encodeURIComponent(id)}&e=${encodeURIComponent(sub.email)}" width="1" height="1" alt="" />`;
    return {
      campaignId: id,
      subscriberId: sub.id,
      email: sub.email,
      from,
      fromName: settings.fromName || undefined,
      subject: campaign.subject,
      html: `${trackedHtml}${pixel}`,
      text: withFooter.text,
    };
  });

  await writeQueueLines(domain, lines);
  campaign.status = "sending";
  campaign.stats = {
    total: lines.length,
    sent: 0,
    failed: 0,
    remaining: lines.length,
  };
  campaign.sendLog = [];
  campaign.updatedAt = new Date().toISOString();
  await writeCampaigns(domain, campaigns);
  emit({ ok: true, queued: lines.length, campaign });
}

export async function newsletterSendBatch(domain, maxArg) {
  const max = Math.min(100, Math.max(1, parseInt(String(maxArg || BATCH_DEFAULT), 10) || BATCH_DEFAULT));
  const settings = await getSettings(domain);
  const mailbox = String(settings.fromMailbox || "info").trim();
  const queue = await readQueueLines(domain);
  if (queue.length === 0) {
    emit({ ok: true, processed: 0, sent: 0, failed: 0, remaining: 0, done: true });
    return;
  }

  const batch = queue.slice(0, max);
  const rest = queue.slice(max);
  const campaigns = await readCampaigns(domain);
  let sent = 0;
  let failed = 0;
  const log = [];

  for (const item of batch) {
    try {
      await sendNewsletterMessage({
        from: item.from || `${mailbox}@${domain}`,
        fromName: item.fromName,
        to: item.email,
        subject: item.subject,
        html: item.html,
        text: item.text,
      });
      sent++;
      log.push({ email: item.email, ok: true, at: new Date().toISOString() });
    } catch (e) {
      failed++;
      log.push({
        email: item.email,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
        at: new Date().toISOString(),
      });
    }
  }

  await writeQueueLines(domain, rest);

  const byCampaign = new Map();
  for (const item of batch) {
    byCampaign.set(item.campaignId, item.campaignId);
  }
  for (const campaignId of byCampaign.keys()) {
    const campaign = campaigns.find((c) => c.id === campaignId);
    if (!campaign) continue;
    const campLog = log.filter((l) =>
      batch.some((b) => b.campaignId === campaignId && b.email === l.email),
    );
    campaign.sendLog = [...(campaign.sendLog ?? []), ...campLog].slice(-500);
    campaign.stats = campaign.stats ?? { total: 0, sent: 0, failed: 0, remaining: 0 };
    campaign.stats.sent = (campaign.stats.sent ?? 0) + campLog.filter((l) => l.ok).length;
    campaign.stats.failed = (campaign.stats.failed ?? 0) + campLog.filter((l) => !l.ok).length;
    campaign.stats.remaining = rest.filter((r) => r.campaignId === campaignId).length;
    if (campaign.stats.remaining === 0 && campaign.status === "sending") {
      campaign.status = campaign.stats.failed > 0 && campaign.stats.sent === 0 ? "failed" : "sent";
      campaign.sentAt = new Date().toISOString();
    }
    campaign.updatedAt = new Date().toISOString();
  }
  await writeCampaigns(domain, campaigns);

  emit({
    ok: true,
    processed: batch.length,
    sent,
    failed,
    remaining: rest.length,
    done: rest.length === 0,
    campaigns: campaigns.filter((c) => byCampaign.has(c.id)),
  });
}

export async function newsletterCampaignTest(domain, payloadJson) {
  let payload = payloadJson;
  if (typeof payloadJson === "string") {
    try {
      payload = JSON.parse(payloadJson);
    } catch {
      fail("Invalid test payload JSON");
    }
  }
  const settings = await getSettings(domain);
  const to = normalizeEmail(payload.to);
  if (!isValidEmail(to)) fail("Valid test recipient required");
  const subject = String(payload.subject ?? "").trim();
  const bodyHtml = String(payload.bodyHtml ?? "").trim();
  const bodyText = String(payload.bodyText ?? "").trim();
  if (!subject) fail("Subject required");
  if (!bodyHtml && !bodyText) fail("Body required");

  const mailbox = String(settings.fromMailbox || "info").trim();
  const from = `${mailbox}@${domain}`;
  const urls = newsletterPublicUrls(domain);
  const unsubUrl = `${urls.unsubscribe}?domain=${encodeURIComponent(domain)}&token=preview`;
  const withFooter = appendUnsubscribeFooter(
    bodyHtml || bodyText.replace(/\n/g, "<br>"),
    bodyText || bodyHtml,
    unsubUrl,
  );
  await sendNewsletterMessage({
    from,
    fromName: settings.fromName || undefined,
    to,
    subject: `[TEST] ${subject}`,
    html: withFooter.html,
    text: withFooter.text,
  });
  emit({ ok: true, to });
}

export async function newsletterPublicSubscribe(domain, payloadJson) {
  const d = String(domain || "").trim().toLowerCase();
  await resolveDomainUser(d);
  const settings = await getSettings(d);
  if (!settings.enabled || !settings.signupEnabled) {
    fail("Newsletter signup is not available for this domain");
  }

  let payload = payloadJson;
  if (typeof payloadJson === "string") {
    try {
      payload = JSON.parse(payloadJson);
    } catch {
      fail("Invalid subscribe JSON");
    }
  }
  if (String(payload.listId || "") !== settings.listId) {
    fail("Invalid list");
  }
  await newsletterSubscriberUpsert(d, {
    email: payload.email,
    name: payload.name,
    source: "form",
  });
}

export async function newsletterPublicConfirm(domain, token) {
  const d = String(domain || "").trim().toLowerCase();
  await resolveDomainUser(d);
  const t = String(token || "").trim();
  if (!t) fail("Token required");
  const subscribers = await readSubscribers(d);
  const sub = subscribers.find((s) => s.confirmToken === t);
  if (!sub) fail("Invalid or expired confirmation link");
  sub.status = "active";
  sub.confirmedAt = new Date().toISOString();
  sub.confirmToken = undefined;
  await writeSubscribers(d, subscribers);
  emit({ ok: true, email: sub.email, status: "active" });
}

export async function newsletterPublicUnsubscribe(domain, token) {
  const d = String(domain || "").trim().toLowerCase();
  await resolveDomainUser(d);
  const t = String(token || "").trim();
  if (!t) fail("Token required");
  const subscribers = await readSubscribers(d);
  const sub = subscribers.find((s) => s.token === t);
  if (!sub) fail("Invalid unsubscribe link");
  sub.status = "unsubscribed";
  sub.unsubscribedAt = new Date().toISOString();
  await writeSubscribers(d, subscribers);
  emit({ ok: true, email: sub.email, status: "unsubscribed" });
}
