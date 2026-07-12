#!/usr/bin/env node
/**
 * Register inveil.net → omiiba.dev mail forwards in panel data + aliases.json.
 * Run via scripts/restore-inveil-mail.sh (root on main VPS).
 */
import {
  loadRegistry,
  saveRegistry,
  writeDomainConfigJson,
  readDomainConfigJson,
  unixUserExists,
} from "./provisioning-common.mjs";

const MAIL_DOMAIN = String(process.env.MAIL_DOMAIN || "omiiba.dev").trim().toLowerCase();
const FORWARD_DOMAIN = String(process.env.FORWARD_DOMAIN || "inveil.net")
  .trim()
  .toLowerCase();
const MAILBOXES = String(
  process.env.MAILBOXES || "info,support,legal,privacy,billing,security,license,dmarc",
)
  .split(/[,;\s]+/)
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

function pickMailUser(rows) {
  const mailRow = rows.find(
    (r) => String(r.name).toLowerCase() === MAIL_DOMAIN && r.user,
  );
  if (mailRow?.user) return String(mailRow.user);
  const forwardRow = rows.find(
    (r) => String(r.name).toLowerCase() === FORWARD_DOMAIN && r.user,
  );
  if (forwardRow?.user) return String(forwardRow.user);
  const base = MAIL_DOMAIN.split(".")[0] || "omiiba";
  if (unixUserExists(base)) return base;
  return base;
}

function upsertDomain(rows, name, user) {
  const d = name.toLowerCase();
  const idx = rows.findIndex((r) => String(r.name).toLowerCase() === d);
  const row = {
    name: d,
    user,
    disabled: false,
    plan: "Default",
  };
  if (idx >= 0) {
    rows[idx] = { ...rows[idx], ...row };
  } else {
    rows.push(row);
  }
}

async function main() {
  let rows = await loadRegistry();
  const mailUser = pickMailUser(rows);

  upsertDomain(rows, MAIL_DOMAIN, mailUser);
  upsertDomain(rows, FORWARD_DOMAIN, mailUser);
  await saveRegistry(rows);

  const existing = await readDomainConfigJson(FORWARD_DOMAIN, "aliases.json", []);
  const byFrom = new Map(
    existing.map((a) => [String(a.from).toLowerCase(), a]),
  );

  for (const local of MAILBOXES) {
    const from = `${local}@${FORWARD_DOMAIN}`;
    const to = `${local}@${MAIL_DOMAIN}`;
    byFrom.set(from, { from, to });
  }

  const aliases = [...byFrom.values()].sort((a, b) =>
    a.from.localeCompare(b.from),
  );
  await writeDomainConfigJson(FORWARD_DOMAIN, "aliases.json", aliases);

  for (const domain of [MAIL_DOMAIN, FORWARD_DOMAIN]) {
    await writeDomainConfigJson(domain, "security.json", {
      dkimEnabled: true,
      spamEnabled: false,
    });
  }

  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      mailDomain: MAIL_DOMAIN,
      forwardDomain: FORWARD_DOMAIN,
      mailUser,
      aliasCount: aliases.length,
      mailboxes: MAILBOXES,
    })}\n`,
  );
}

main().catch((e) => {
  process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
