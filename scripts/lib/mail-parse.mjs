/** Minimal RFC822 header parsing for Maildir files (no MIME decoder). */

export function parseMailHeaders(raw) {
  const text = raw.slice(0, 64 * 1024);
  const headerEnd = text.search(/\r?\n\r?\n/);
  const block = headerEnd >= 0 ? text.slice(0, headerEnd) : text;
  const unfolded = block.replace(/\r?\n[ \t]+/g, " ");
  const pick = (name) => {
    const m = unfolded.match(new RegExp(`^${name}:\\s*(.+)$`, "im"));
    return m ? m[1].trim() : "";
  };
  return {
    subject: pick("Subject") || pick("subject"),
    from: pick("From") || pick("from"),
    to: pick("To") || pick("to"),
    date: pick("Date") || pick("date"),
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
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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
