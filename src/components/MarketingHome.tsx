import { getMarketingBodyHtml } from "@/lib/marketing";
import Script from "next/script";

/**
 * Renders the static marketing landing-page HTML inside the Next.js app.
 *
 * The HTML body is authored by hand in `marketing-site/index.html` and
 * injected via dangerouslySetInnerHTML, which means it references the
 * IBM Plex Sans / Newsreader + `/landing.css` classes directly in its markup. Migrating
 * to `next/font` or a CSS import would require re-templating the entire
 * marketing site to use Next-generated class names, which we deliberately
 * avoid - the static HTML doubles as a standalone build (see
 * `scripts/build-marketing-zip.sh`).
 *
 * The Next.js lint rules `no-page-custom-font` and `no-css-tags` fire on
 * these inline <link> tags. We accept the trade-off and disable them here
 * with a clear rationale rather than hide them globally.
 */
export function MarketingHome() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin="anonymous"
      />
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- marketing HTML is authored standalone and ships the same font link in both the Next route and the static build. */}
      <link
        href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=Newsreader:opsz,wght@6..72,500&display=swap"
        rel="stylesheet"
      />
      {/* eslint-disable-next-line @next/next/no-css-tags -- landing.css is shared verbatim with the static marketing build; not eligible for Next's CSS pipeline. */}
      <link rel="stylesheet" href="/landing.css" />
      <div dangerouslySetInnerHTML={{ __html: getMarketingBodyHtml() }} />
      <Script src="/landing.js" strategy="afterInteractive" />
    </>
  );
}
