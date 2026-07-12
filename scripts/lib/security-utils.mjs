/** Escape a string for safe use inside a RegExp literal. */
export function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const DOMAIN_RE =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

export function assertDomainName(domain) {
  const name = String(domain || "").trim().toLowerCase();
  if (!DOMAIN_RE.test(name) || name.length > 253) {
    throw new Error(`Invalid domain name: ${domain}`);
  }
  return name;
}

export function escapeShellSingle(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function removeBalancedTag(html, tagName) {
  const open = `<${tagName}`;
  const close = `</${tagName}>`;
  let result = html;
  let lower = result.toLowerCase();
  let start = lower.indexOf(open);
  while (start >= 0) {
    const openEnd = result.indexOf(">", start);
    if (openEnd < 0) break;
    const closeStart = lower.indexOf(close, openEnd);
    if (closeStart < 0) break;
    result = result.slice(0, start) + result.slice(closeStart + close.length);
    lower = result.toLowerCase();
    start = lower.indexOf(open);
  }
  return result;
}

function decodeBasicEntities(text) {
  return text
    .split("&nbsp;").join(" ")
    .split("&amp;").join("&")
    .split("&lt;").join("<")
    .split("&gt;").join(">");
}

function insertBreaksBeforeTags(html) {
  let out = "";
  let i = 0;
  const lower = html.toLowerCase();
  while (i < html.length) {
    if (lower.startsWith("<br", i)) {
      out += "\n";
      i = html.indexOf(">", i);
      if (i < 0) break;
      i += 1;
      continue;
    }
    if (lower.startsWith("</p>", i)) {
      out += "\n";
      i += 4;
      continue;
    }
    out += html[i];
    i += 1;
  }
  return out;
}

/** Strip HTML tags for plain-text previews without nested regex on untrusted input. */
export function stripHtmlTags(html) {
  let text = removeBalancedTag(String(html ?? ""), "style");
  text = removeBalancedTag(text, "script");
  text = insertBreaksBeforeTags(text);
  let out = "";
  let inTag = false;
  for (const ch of text) {
    if (ch === "<") {
      inTag = true;
      continue;
    }
    if (ch === ">") {
      inTag = false;
      continue;
    }
    if (!inTag) out += ch;
  }
  out = decodeBasicEntities(out);
  while (out.includes("\n\n\n")) {
    out = out.replace("\n\n\n", "\n\n");
  }
  return out.trim();
}

/** Escape a value for a PHP single-quoted string literal. */
export function escapePhpSingleQuoted(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\0/g, "");
}
