/** Minimal RFC822 header parsing for Maildir files (no MIME decoder). */
import { stripHtmlTags } from "./security-utils.mjs";

const HEADER_NAMES = new Set([
  "subject",
  "from",
  "to",
  "cc",
  "date",
  "message-id",
  "reply-to",
  "references",
]);

function unfoldHeaders(block) {
  const lines = block.split(/\r?\n/);
  const out = [];
  for (const line of lines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length > 0) {
      out[out.length - 1] += ` ${line.trim()}`;
    } else {
      out.push(line);
    }
  }
  return out;
}

function pickHeader(unfolded, name) {
  const target = `${name.toLowerCase()}:`;
  for (const line of unfolded) {
    const idx = line.toLowerCase().indexOf(target);
    if (idx === 0) {
      return line.slice(target.length).trim();
    }
  }
  return "";
}

export function parseMailHeaders(raw) {
  const text = raw.slice(0, 64 * 1024);
  const headerEnd = text.search(/\r?\n\r?\n/);
  const block = headerEnd >= 0 ? text.slice(0, headerEnd) : text;
  const unfolded = unfoldHeaders(block);
  const pick = (name) => {
    if (!HEADER_NAMES.has(name.toLowerCase())) return "";
    return pickHeader(unfolded, name);
  };
  return {
    subject: pick("Subject") || pick("subject"),
    from: pick("From") || pick("from"),
    to: pick("To") || pick("to"),
    cc: pick("Cc") || pick("cc"),
    date: pick("Date") || pick("date"),
    messageId: pick("Message-ID") || pick("Message-Id"),
    replyTo: pick("Reply-To") || pick("Reply-to"),
    references: pick("References") || pick("references"),
  };
}

export function splitHeadersAndBody(raw) {
  const m = raw.match(/\r?\n\r?\n/);
  if (!m || m.index === undefined) {
    return { headers: raw, body: "" };
  }
  return {
    headers: raw.slice(0, m.index),
    body: raw.slice(m.index + m[0].length),
  };
}

/** Strip HTML tags for a simple text preview. */
export function htmlToText(html) {
  return stripHtmlTags(html);
}

export function bodyPreview(body, max = 8000) {
  const trimmed = body.trim();
  if (!trimmed) return "";
  if (/^Content-Type:\s*text\/html/im.test(trimmed.slice(0, 500))) {
    const part = trimmed.split(/\r?\n\r?\n/).slice(1).join("\n\n");
    return htmlToText(part).slice(0, max);
  }
  return trimmed.slice(0, max);
}
