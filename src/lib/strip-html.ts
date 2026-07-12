function removeBalancedTag(html: string, tagName: string): string {
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

function decodeBasicEntities(text: string): string {
  return text
    .split("&nbsp;").join(" ")
    .split("&amp;").join("&")
    .split("&lt;").join("<")
    .split("&gt;").join(">");
}

/** Strip HTML tags for plain-text previews without regex on untrusted input. */
export function stripHtmlTags(html: string): string {
  let text = removeBalancedTag(html, "style");
  text = removeBalancedTag(text, "script");
  text = text.split(/<br\s*\/?>/gi).join("\n");
  text = text.split(/<\/p>/gi).join("\n");
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
