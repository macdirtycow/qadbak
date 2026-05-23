/** Product name shown in UI and metadata. */
export const APP_NAME = "Qadbak";

export const APP_TAGLINE = "Independent hosting control panel";

/** One-line origin story (2009 headline → VPS panel). See docs/ABOUT-THE-NAME.md */
export const APP_NAME_BLURB =
  "Named after an infamous 2009 shell — rebuilt as a self-hosted panel for domains, mail, and DNS.";

/** Panel hostname (set at install; no trailing slash). */
export const APP_SITE = process.env.QADBAK_PUBLIC_HOST ?? "qadbak.com";

export const APP_URL = `https://${APP_SITE}`;

/** Parent brand / official sites (not the panel host). */
export const ORG_NAME = "Omiiba";

export const ORG_SITE = "omiiba.dev";

export const ORG_URL = `https://${ORG_SITE}`;

export const ORG_SITE_ALT = "omiiba.com";

export const ORG_URL_ALT = `https://${ORG_SITE_ALT}`;
