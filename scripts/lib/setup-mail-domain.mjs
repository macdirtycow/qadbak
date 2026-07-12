#!/usr/bin/env node
/** Register a mail domain in panel data (native-domains.json + DKIM flag). */
import {
  loadRegistry,
  saveRegistry,
  writeDomainConfigJson,
  unixUserExists,
} from "./provisioning-common.mjs";

const MAIL_DOMAIN = String(process.env.MAIL_DOMAIN || "inveil.net").trim().toLowerCase();

function pickUser(rows) {
  const hit = rows.find((r) => String(r.name).toLowerCase() === MAIL_DOMAIN && r.user);
  if (hit?.user) return String(hit.user);
  const base = MAIL_DOMAIN.split(".")[0] || "inveil";
  if (unixUserExists(base)) return base;
  return base;
}

async function main() {
  const rows = await loadRegistry();
  const user = pickUser(rows);
  const idx = rows.findIndex((r) => String(r.name).toLowerCase() === MAIL_DOMAIN);
  const row = { name: MAIL_DOMAIN, user, disabled: false, plan: "Default" };
  if (idx >= 0) rows[idx] = { ...rows[idx], ...row };
  else rows.push(row);
  await saveRegistry(rows);
  await writeDomainConfigJson(MAIL_DOMAIN, "security.json", {
    dkimEnabled: true,
    spamEnabled: false,
  });
  process.stdout.write(
    `${JSON.stringify({ ok: true, mailDomain: MAIL_DOMAIN, mailUser: user })}\n`,
  );
}

main().catch((e) => {
  process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
