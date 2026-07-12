import { randomBytes } from "node:crypto";
import { queueSendmail, deliverLocalMessage } from "./mail-queue.mjs";
import { stripHtmlTags } from "./security-utils.mjs";

function panelBaseUrl() {
  const host =
    process.env.QADBAK_PUBLIC_HOST?.trim() ||
    process.env.QADBAK_PANEL_HOST?.trim() ||
    "localhost";
  const proto = host.includes("localhost") ? "http" : "https";
  return `${proto}://${host}`;
}

export function newsletterPublicUrls(domain) {
  const base = panelBaseUrl();
  return {
    confirm: `${base}/api/newsletter/confirm`,
    unsubscribe: `${base}/api/newsletter/unsubscribe`,
    subscribe: `${base}/api/newsletter/subscribe`,
  };
}

export function buildNewsletterHtmlMessage(from, to, subject, html, text, opts = {}) {
  const subj = String(subject || "").replace(/\r?\n/g, " ").trim() || "(no subject)";
  const plain = String(text ?? "").trim() || stripHtml(String(html ?? ""));
  const bodyHtml = String(html ?? "").trim() || plain.replace(/\n/g, "<br>\n");
  const boundary = `qb_${randomBytes(8).toString("hex")}`;
  const messageId =
    String(opts.messageId || "").trim() ||
    `<${randomBytes(12).toString("hex")}@${String(from).split("@")[1] || "qadbak"}>`;
  const date = opts.date || new Date().toUTCString();
  const toLine = String(to || "").trim() || from;

  const lines = [
    `From: ${opts.fromName ? `"${opts.fromName}" <${from}>` : from}`,
    `To: ${toLine}`,
    `Subject: ${subj}`,
    `Date: ${date}`,
    `Message-ID: ${messageId}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    plain,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    bodyHtml,
    "",
    `--${boundary}--`,
    "",
  ];
  return lines.join("\r\n");
}

function stripHtml(html) {
  return stripHtmlTags(html);
}

export function wrapNewsletterLinksForTracking(html, opts) {
  const { trackBase, domain, campaignId, email } = opts;
  return String(html).replace(/href="(https?:\/\/[^"#]+)"/gi, (full, url) => {
    if (
      url.includes("/api/newsletter/track") ||
      url.includes("/api/newsletter/unsubscribe") ||
      url.includes("/api/newsletter/confirm")
    ) {
      return full;
    }
    const tracked = `${trackBase}?domain=${encodeURIComponent(domain)}&kind=click&c=${encodeURIComponent(campaignId)}&e=${encodeURIComponent(email)}&url=${encodeURIComponent(url)}`;
    return `href="${tracked}"`;
  });
}

export function appendUnsubscribeFooter(html, text, unsubscribeUrl) {
  const htmlFooter = `<hr style="border:none;border-top:1px solid #ccc;margin:24px 0"/><p style="font-size:12px;color:#666">You received this email because you subscribed to our newsletter. <a href="${unsubscribeUrl}">Unsubscribe</a></p>`;
  const textFooter = `\n\n---\nUnsubscribe: ${unsubscribeUrl}`;
  return {
    html: `${html}${htmlFooter}`,
    text: `${text}${textFooter}`,
  };
}

export async function sendNewsletterMessage({ from, fromName, to, subject, html, text }) {
  const message = buildNewsletterHtmlMessage(from, to, subject, html, text, { fromName });
  const toDomain = to.split("@")[1]?.toLowerCase() ?? "";
  const fromDomain = from.split("@")[1]?.toLowerCase() ?? "";
  const sameDomain = toDomain === fromDomain;

  if (sameDomain) {
    await deliverLocalMessage(to, subject, text, from);
  } else {
    await queueSendmail(from, message);
  }
  return { ok: true, to, from, source: sameDomain ? "smtp-local" : "sendmail" };
}
