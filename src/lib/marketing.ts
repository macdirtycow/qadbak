import { readFileSync } from "fs";
import { join } from "path";

const cachedBodies = new Map<string, string>();

function removeLandingScript(html: string): string {
  const needle = "landing.js";
  let result = html;
  let lower = result.toLowerCase();
  let start = lower.indexOf("<script");
  while (start >= 0) {
    const endTag = lower.indexOf("</script>", start);
    if (endTag < 0) break;
    const chunk = result.slice(start, endTag + 9);
    if (chunk.includes(needle)) {
      result = result.slice(0, start) + result.slice(endTag + 9);
    } else {
      start = lower.indexOf("<script", endTag);
      continue;
    }
    lower = result.toLowerCase();
    start = lower.indexOf("<script");
  }
  return result;
}

function extractBody(htmlPath: string): string {
  const cached = cachedBodies.get(htmlPath);
  if (cached) return cached;
  const raw = readFileSync(join(process.cwd(), htmlPath), "utf8");
  const bodyStart = raw.toLowerCase().indexOf("<body");
  if (bodyStart < 0) {
    throw new Error(`${htmlPath}: missing <body>`);
  }
  const openEnd = raw.indexOf(">", bodyStart);
  const bodyClose = raw.toLowerCase().lastIndexOf("</body>");
  if (openEnd < 0 || bodyClose < 0) {
    throw new Error(`${htmlPath}: missing <body>`);
  }
  const body = removeLandingScript(raw.slice(openEnd + 1, bodyClose));
  cachedBodies.set(htmlPath, body);
  return body;
}

/** Inner HTML of marketing-site/index.html (shared with static zip). */
export function getMarketingBodyHtml(): string {
  return extractBody("marketing-site/index.html");
}

/** Inner HTML of a legal page (e.g. "privacy", "terms", "refund"). */
export function getLegalBodyHtml(
  slug: "privacy" | "terms" | "refund",
): string {
  return extractBody(`marketing-site/${slug}/index.html`);
}

/** Inner HTML of marketing-site/about.html */
export function getAboutBodyHtml(): string {
  return extractBody("marketing-site/about.html");
}
