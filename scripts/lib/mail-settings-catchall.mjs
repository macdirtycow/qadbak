import { readDomainConfigJson } from "./provisioning-common.mjs";

const DEFAULTS = {
  catchAll: "",
  autoresponder: "",
  autoresponderEnabled: false,
};

/** Normalize catch-all target to a full email on this domain when possible. */
export function normalizeCatchAllAddress(raw, domain) {
  const d = String(domain).trim().toLowerCase();
  const v = String(raw || "").trim();
  if (!v) return "";
  if (v.includes("@")) {
    return v.toLowerCase();
  }
  const local = v.replace(/[^a-z0-9._+-]/gi, "").slice(0, 64);
  if (!local) return "";
  return `${local}@${d}`;
}

/** Postfix catch-all map rows: @domain → mailbox@domain */
export async function readMailSettingsCatchAllEntries(rows) {
  const entries = [];
  for (const row of rows) {
    if (!row.name || row.disabled || row.type === "alias") continue;
    const domain = String(row.name).toLowerCase();
    const settings = await readDomainConfigJson(
      domain,
      "mail-settings.json",
      DEFAULTS,
    );
    const dest = normalizeCatchAllAddress(settings.catchAll, domain);
    if (dest) {
      entries.push({
        address: `@${domain}`,
        destination: dest,
      });
    }
  }
  return entries;
}
