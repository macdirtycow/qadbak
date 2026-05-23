#!/usr/bin/env node
/**
 * Native provisioning (phase 8) — SSL, DNS, mail, DB, domain, backup, cron without remote.cgi.
 */
import { emit } from "./lib/provisioning-common.mjs";
import { loadEnvLocal } from "./lib/load-env-local.mjs";
import { sslList, sslIssue } from "./lib/provision-ssl.mjs";
import { dnsGet, dnsAdd, dnsDel } from "./lib/provision-dns.mjs";
import { mailList, mailCreate, mailDelete, mailPass } from "./lib/provision-mail.mjs";
import { dbList, dbCreate, dbPass } from "./lib/provision-db.mjs";
import { domainCreate, domainDelete } from "./lib/provision-domain.mjs";
import { backupList, backupCreate } from "./lib/provision-backup.mjs";
import { cronList, cronCreate, cronDelete } from "./lib/provision-cron.mjs";
import { aliasList, aliasCreate, aliasDelete } from "./lib/provision-aliases.mjs";
import { redirectList, redirectCreate, redirectDelete } from "./lib/provision-redirects.mjs";
import { featureList, featureSet } from "./lib/provision-features.mjs";
import { logsTail } from "./lib/provision-logs.mjs";
import {
  phpVersions,
  phpDirectories,
  phpIni,
  phpSetDirectory,
} from "./lib/provision-php.mjs";
import { ftpList, ftpCreate, ftpDelete, ftpPass } from "./lib/provision-ftp.mjs";
import { limitsGet, limitsSet } from "./lib/provision-limits.mjs";
import {
  domainEnable,
  domainDisable,
  domainValidate,
} from "./lib/provision-lifecycle.mjs";
import { mailSettingsGet, mailSettingsSet } from "./lib/provision-mail-settings.mjs";
import { mailLogsSearch } from "./lib/provision-mail-logs.mjs";
import { imapList, imapCopy, imapMessages, imapFetch } from "./lib/provision-imap.mjs";
import {
  protectedList,
  protectedCreate,
  protectedDelete,
} from "./lib/provision-protected.mjs";
import {
  sharedList,
  sharedCreate,
  sharedDelete,
} from "./lib/provision-shared.mjs";

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
  await loadEnvLocal();
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
    case "alias-list":
      await aliasList(args[0]);
      break;
    case "alias-create":
      await aliasCreate(args[0], args[1], args[2]);
      break;
    case "alias-delete":
      await aliasDelete(args[0], args[1]);
      break;
    case "redirect-list":
      await redirectList(args[0]);
      break;
    case "redirect-create":
      await redirectCreate(args[0], args[1], args[2], args[3]);
      break;
    case "redirect-delete":
      await redirectDelete(args[0], args[1]);
      break;
    case "feature-list":
      await featureList(args[0]);
      break;
    case "feature-set":
      await featureSet(args[0], args[1], args[2] === "true" || args[2] === "1");
      break;
    case "logs-tail":
      await logsTail(args[0], args[1] || "access");
      break;
    case "php-versions":
      await phpVersions(args[0]);
      break;
    case "php-directories":
      await phpDirectories(args[0]);
      break;
    case "php-ini":
      await phpIni(args[0], args[1]);
      break;
    case "php-set-directory":
      await phpSetDirectory(args[0], args[1], args[2]);
      break;
    case "ftp-list":
      await ftpList(args[0]);
      break;
    case "ftp-create":
      await ftpCreate(args[0], args[1], args[2]);
      break;
    case "ftp-delete":
      await ftpDelete(args[0], args[1]);
      break;
    case "ftp-pass":
      await ftpPass(args[0], args[1], args[2]);
      break;
    case "limits-get":
      await limitsGet(args[0]);
      break;
    case "limits-set":
      await limitsSet(args[0], args[1]);
      break;
    case "domain-enable":
      await domainEnable(args[0]);
      break;
    case "domain-disable":
      await domainDisable(args[0]);
      break;
    case "domain-validate":
      await domainValidate(args[0]);
      break;
    case "mail-logs-search":
      await mailLogsSearch(args[0], args[1] || "");
      break;
    case "imap-list":
      await imapList(args[0], args[1]);
      break;
    case "imap-copy":
      await imapCopy(args[0], args[1], args[2], args[3]);
      break;
    case "imap-messages":
      await imapMessages(args[0], args[1], args[2]);
      break;
    case "imap-fetch":
      await imapFetch(args[0], args[1], args[2], args[3]);
      break;
    case "protected-list":
      await protectedList(args[0]);
      break;
    case "protected-create":
      await protectedCreate(args[0], args[1]);
      break;
    case "protected-delete":
      await protectedDelete(args[0], args[1]);
      break;
    case "shared-list":
      await sharedList(args[0]);
      break;
    case "shared-create":
      await sharedCreate(args[0], args[1], args[2]);
      break;
    case "shared-delete":
      await sharedDelete(args[0], args[1]);
      break;
    case "mail-settings-get":
      await mailSettingsGet(args[0]);
      break;
    case "mail-settings-set":
      await mailSettingsSet(args[0], args[1]);
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
