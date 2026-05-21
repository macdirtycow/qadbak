import { readFileSync } from "fs";
import { join } from "path";

let cachedBody: string | null = null;

/** Inner HTML of marketing-site/index.html (shared with static zip). */
export function getMarketingBodyHtml(): string {
  if (cachedBody) return cachedBody;
  const raw = readFileSync(
    join(process.cwd(), "marketing-site/index.html"),
    "utf8",
  );
  const match = raw.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (!match) {
    throw new Error("marketing-site/index.html: missing <body>");
  }
  cachedBody = match[1].replace(
    /<script[^>]*src="[^"]*landing\.js"[^>]*>\s*<\/script>\s*/i,
    "",
  );
  return cachedBody;
}
