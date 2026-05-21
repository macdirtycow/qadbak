import { getMarketingBodyHtml } from "@/lib/marketing";
import Script from "next/script";

export function MarketingHome() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin="anonymous"
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      <link rel="stylesheet" href="/landing.css" />
      <div dangerouslySetInnerHTML={{ __html: getMarketingBodyHtml() }} />
      <Script src="/landing.js" strategy="afterInteractive" />
    </>
  );
}
