import { resolveMailboxMaildir } from "./mail-layout.mjs";
import { kbToDisplayMb, pathSizeKb } from "./disk-usage.mjs";
import { readDomainConfigJson } from "./provisioning-common.mjs";

/** Add Maildir usage (MB) per mailbox for the panel list. */
export async function enrichMailboxesWithUsage(layout, mailboxes, domain) {
  const owner = layout.owner;
  const home = layout.home;
  const quotaCfg = domain
    ? await readDomainConfigJson(domain, "mailbox-quotas.json", { limits: {} }).catch(() => ({
        limits: {},
      }))
    : { limits: {} };
  const limits = quotaCfg.limits ?? {};
  const out = [];

  for (const m of mailboxes) {
    const local = String(m.user || m.name || "").trim().toLowerCase();
    let usedMb = "0";
    if (local) {
      try {
        const maildir = await resolveMailboxMaildir(layout, local, owner, home);
        const kb = await pathSizeKb(maildir);
        usedMb = kbToDisplayMb(kb);
      } catch {
        usedMb = "0";
      }
    }
    const limit = limits[local];
    out.push({
      ...m,
      quotaUsedMb: usedMb,
      quota: limit?.quotaMb ? String(limit.quotaMb) : usedMb,
      quotaLimitMb: limit?.quotaMb ?? null,
    });
  }

  return out;
}
