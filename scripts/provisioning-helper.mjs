#!/usr/bin/env node
/**
 * Native provisioning (phase 8) — SSL, DNS, mail, DB, domain, backup, cron without remote.cgi.
 */
import { emit } from "./lib/provisioning-common.mjs";
import { sslList, sslIssue } from "./lib/provision-ssl.mjs";
import { dnsGet, dnsAdd, dnsDel } from "./lib/provision-dns.mjs";
import { mailList, mailCreate, mailDelete, mailPass } from "./lib/provision-mail.mjs";
import { dbList, dbCreate, dbPass } from "./lib/provision-db.mjs";
import { domainCreate, domainDelete } from "./lib/provision-domain.mjs";
import { backupList, backupCreate } from "./lib/provision-backup.mjs";
import { cronList, cronCreate, cronDelete } from "./lib/provision-cron.mjs";

const cmd = process.argv[2];
const args = process.argv.slice(3);

function parseJsonArg(i) {
  try {
    return JSON.parse(args[i] ?? "{}");
  } catch {
    return {};
  }
}

async function main() {
  switch (cmd) {
    case "ping":
      emit({ ok: true, helper: "provisioning-helper", phase: 8 });
      break;
    case "ssl-list":
      await sslList(args[0]);
      break;
    case "ssl-issue":
      await sslIssue(args[0], args[1]);
      break;
    case "dns-get":
      await dnsGet(args[0]);
      break;
    case "dns-add":
      await dnsAdd(args[0], parseJsonArg(1));
      break;
    case "dns-del":
      await dnsDel(args[0], parseJsonArg(1));
      break;
    case "mail-list":
      await mailList(args[0]);
      break;
    case "mail-create":
      await mailCreate(args[0], args[1], args[2], args[3]);
      break;
    case "mail-delete":
      await mailDelete(args[0], args[1]);
      break;
    case "mail-pass":
      await mailPass(args[0], args[1], args[2]);
      break;
    case "db-list":
      await dbList(args[0]);
      break;
    case "db-create":
      await dbCreate(args[0], args[1], args[2]);
      break;
    case "db-pass":
      await dbPass(args[0], args[1], args[2]);
      break;
    case "domain-create":
      await domainCreate(args[0], args[1], args[2]);
      break;
    case "domain-delete":
      await domainDelete(args[0]);
      break;
    case "backup-list":
      await backupList(args[0]);
      break;
    case "backup-create":
      await backupCreate(args[0]);
      break;
    case "cron-list":
      await cronList(args[0]);
      break;
    case "cron-create":
      await cronCreate(args[0], args[1], args.slice(2).join(" "));
      break;
    case "cron-delete":
      await cronDelete(args[0], args[1]);
      break;
    default:
      emit({ ok: false, error: `Unknown command: ${cmd}` });
      process.exit(1);
  }
}

main().catch((e) => {
  emit({ ok: false, error: e instanceof Error ? e.message : String(e) });
  process.exit(1);
});
