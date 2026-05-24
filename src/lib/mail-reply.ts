/** Helpers for reply / forward in the panel IMAP UI. */

export function parseEmailAddress(header: string | undefined): string {
  const raw = String(header || "").trim();
  if (!raw) return "";
  const angle = raw.match(/<([^>]+@[^>]+)>/);
  if (angle) return angle[1].trim().toLowerCase();
  const bare = raw.match(/[\w.+-]+@[\w.-]+\.\w+/);
  return bare ? bare[0].toLowerCase() : raw.toLowerCase();
}

export function parseAddressList(header: string | undefined): string[] {
  const raw = String(header || "").trim();
  if (!raw) return [];
  const out = new Set<string>();
  for (const part of raw.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)) {
    const addr = parseEmailAddress(part);
    if (addr.includes("@")) out.add(addr);
  }
  return [...out];
}

export function replySubject(subject: string): string {
  const s = String(subject || "").trim() || "(no subject)";
  if (/^re:\s/i.test(s)) return s;
  return `Re: ${s}`;
}

export function forwardSubject(subject: string): string {
  const s = String(subject || "").trim() || "(no subject)";
  if (/^(fwd|fw):\s/i.test(s)) return s;
  return `Fwd: ${s}`;
}

export function quoteReplyBody(opts: {
  from?: string;
  date?: string;
  bodyText?: string;
}): string {
  const from = opts.from || "unknown sender";
  const when = opts.date ? `On ${opts.date}, ` : "";
  const body = String(opts.bodyText || "").trim();
  if (!body) return `\n\n${when}${from} wrote:\n`;
  const quoted = body
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
  return `\n\n${when}${from} wrote:\n${quoted}\n`;
}

export function forwardBody(opts: {
  from?: string;
  to?: string;
  date?: string;
  subject?: string;
  bodyText?: string;
}): string {
  const lines = [
    "---------- Forwarded message ----------",
    opts.from ? `From: ${opts.from}` : "",
    opts.date ? `Date: ${opts.date}` : "",
    opts.to ? `To: ${opts.to}` : "",
    opts.subject ? `Subject: ${opts.subject}` : "",
    "",
    String(opts.bodyText || "").trim(),
    "",
  ].filter((l, i, arr) => l !== "" || i < arr.length - 1);
  return `\n\n${lines.join("\n")}`;
}

export function buildReferencesHeader(
  existing: string | undefined,
  messageId: string | undefined,
): string | undefined {
  const id = String(messageId || "").trim();
  if (!id) return existing?.trim() || undefined;
  const prior = String(existing || "").trim();
  if (!prior) return id;
  if (prior.includes(id)) return prior;
  return `${prior} ${id}`;
}
