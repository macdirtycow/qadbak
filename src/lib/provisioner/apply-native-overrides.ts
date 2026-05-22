import { nativeFeatureEnabled } from "./native-features";
import * as native from "./native-ops";
import type { Provisioner } from "./types";

/** Patch provisioner methods when QADBAK_NATIVE_FEATURES includes a module. */
export function applyNativeOverrides<T extends Provisioner>(base: T): T {
  const out = { ...base };

  if (nativeFeatureEnabled("ssl")) {
    out.listSslCerts = native.listSslCertsNative;
    out.requestLetsEncrypt = native.requestLetsEncryptNative;
  }
  if (nativeFeatureEnabled("dns")) {
    out.getDns = native.getDnsNative;
    out.addDnsRecord = native.addDnsRecordNative;
    out.deleteDnsRecord = native.deleteDnsRecordNative;
  }
  if (nativeFeatureEnabled("mail")) {
    out.listMailboxes = native.listMailboxesNative;
    out.createMailbox = native.createMailboxNative;
    out.updateMailboxPassword = native.updateMailboxPasswordNative;
    out.deleteMailbox = native.deleteMailboxNative;
  }
  if (nativeFeatureEnabled("db")) {
    out.listDatabases = native.listDatabasesNative;
    out.createDatabase = native.createDatabaseNative;
    out.updateDatabasePassword = native.updateDatabasePasswordNative;
  }
  if (nativeFeatureEnabled("domain")) {
    out.createDomain = native.createDomainNative;
    out.deleteDomain = native.deleteDomainNative;
  }
  if (nativeFeatureEnabled("backup")) {
    out.listScheduledBackups = native.listScheduledBackupsNative;
    out.startBackup = native.startBackupNative;
  }
  if (nativeFeatureEnabled("cron")) {
    out.listCronJobs = native.listCronJobsNative;
    out.listCronJobsWithFallback = native.listCronJobsNative;
    out.createCronJob = native.createCronJobNative;
    out.deleteCronJob = native.deleteCronJobNative;
  }

  return out;
}
