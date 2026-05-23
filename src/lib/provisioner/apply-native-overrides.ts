import { nativeFeatureEnabled } from "./native-features";
import * as indep from "./independent-ops";
import * as native from "./native-ops";
import { isIndependentMode } from "./native-stub";
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
    out.restoreDomain = native.restoreDomainNative;
    out.modifyScheduledBackup = native.modifyScheduledBackupNative;
  }
  if (nativeFeatureEnabled("cron")) {
    out.listCronJobs = native.listCronJobsNative;
    out.listCronJobsWithFallback = native.listCronJobsNative;
    out.createCronJob = native.createCronJobNative;
    out.deleteCronJob = native.deleteCronJobNative;
  }
  if (nativeFeatureEnabled("aliases")) {
    out.listAliases = native.listAliasesNative;
    out.createAlias = native.createAliasNative;
    out.deleteAlias = native.deleteAliasNative;
  }
  if (nativeFeatureEnabled("redirects")) {
    out.listRedirects = native.listRedirectsNative;
    out.createRedirect = native.createRedirectNative;
    out.deleteRedirect = native.deleteRedirectNative;
  }
  if (nativeFeatureEnabled("features")) {
    out.listDomainFeatures = native.listDomainFeaturesNative;
    out.setDomainFeature = native.setDomainFeatureNative;
  }
  if (nativeFeatureEnabled("logs")) {
    out.getWebsiteLogs = native.getWebsiteLogsNative;
  }
  if (nativeFeatureEnabled("php")) {
    out.listPhpVersions = native.listPhpVersionsNative;
    out.listPhpDirectories = native.listPhpDirectoriesNative;
    out.listPhpIni = native.listPhpIniNative;
    out.setPhpDirectory = native.setPhpDirectoryNative;
  }
  if (nativeFeatureEnabled("ftp")) {
    out.listFtpAccounts = native.listFtpAccountsSafeNative;
    out.listFtpAccountsSafe = native.listFtpAccountsSafeNative;
    out.createFtpAccount = native.createFtpAccountNative;
    out.updateFtpPassword = native.updateFtpPasswordNative;
    out.deleteFtpAccount = native.deleteFtpAccountNative;
  }
  if (nativeFeatureEnabled("limits")) {
    out.getDomainLimits = native.getDomainLimitsNative;
    out.updateDomainLimits = native.updateDomainLimitsNative;
  }
  if (nativeFeatureEnabled("lifecycle")) {
    out.setDomainEnabled = native.setDomainEnabledNative;
    out.validateDomain = native.validateDomainNative;
  }
  if (nativeFeatureEnabled("mail-logs")) {
    out.searchMailLogs = native.searchMailLogsNative;
    out.resendEmail = native.resendEmailNative;
  }
  if (nativeFeatureEnabled("imap")) {
    out.listImapMailboxes = native.listImapMailboxesNative;
    out.copyMailbox = native.copyMailboxNative;
  }
  if (nativeFeatureEnabled("protected")) {
    out.listProtectedDirectories = native.listProtectedDirectoriesNative;
    out.createProtectedDirectory = native.createProtectedDirectoryNative;
    out.deleteProtectedDirectory = native.deleteProtectedDirectoryNative;
    out.listProtectedUsers = native.listProtectedUsersNative;
    out.createProtectedUser = native.createProtectedUserNative;
    out.deleteProtectedUser = native.deleteProtectedUserNative;
  }
  if (nativeFeatureEnabled("shared")) {
    out.listSharedAddresses = native.listSharedAddressesNative;
    out.createSharedAddress = native.createSharedAddressNative;
    out.deleteSharedAddress = native.deleteSharedAddressNative;
  }
  if (nativeFeatureEnabled("mail-settings")) {
    out.getMailSettings = native.getMailSettingsNative;
    out.updateMailSettings = native.updateMailSettingsNative;
  }
  if (nativeFeatureEnabled("proxies")) {
    out.listProxies = native.listProxiesNative;
    out.createProxy = native.createProxyNative;
    out.deleteProxy = native.deleteProxyNative;
  }
  if (nativeFeatureEnabled("scripts")) {
    out.listAvailableScripts = native.listAvailableScriptsNative;
    out.listInstalledScripts = native.listInstalledScriptsNative;
    out.installScript = native.installScriptNative;
    out.deleteInstalledScript = native.deleteInstalledScriptNative;
  }
  if (nativeFeatureEnabled("security")) {
    out.getMailSecurity = native.getMailSecurityNative;
    out.setSpamFilter = native.setSpamFilterNative;
    out.setDkim = native.setDkimNative;
  }
  if (nativeFeatureEnabled("resellers")) {
    out.listResellers = native.listResellersNative;
    out.createReseller = native.createResellerNative;
    out.deleteReseller = native.deleteResellerNative;
    out.listPlans = native.listPlansNative;
    out.createPlan = native.createPlanNative;
    out.deletePlan = native.deletePlanNative;
  }

  if (isIndependentMode()) {
    out.cloneDomain = indep.cloneDomainIndependent;
    out.migrateDomain = indep.migrateDomainIndependent;
    out.transferDomain = indep.transferDomainIndependent;
    out.checkServerConfig = indep.checkServerConfigIndependent;
    out.getLicenseInfo = indep.getLicenseInfoIndependent;
    out.listTemplates = indep.listTemplatesIndependent;
    out.listAdmins = indep.listAdminsIndependent;
    out.createAdmin = indep.createAdminIndependent;
    out.deleteAdmin = indep.deleteAdminIndependent;
    out.listGlobalFeatures = indep.listGlobalFeaturesIndependent;
    out.setGlobalFeature = indep.setGlobalFeatureIndependent;
    out.runConfigSystem = indep.runConfigSystemIndependent;
    out.listS3Buckets = indep.listS3BucketsIndependent;
    out.listS3Files = indep.listS3FilesIndependent;
    out.uploadS3File = indep.uploadS3FileIndependent;
    out.listBandwidth = indep.listBandwidthIndependent;
    out.listServerStatuses = indep.listServerStatusesIndependent;
    out.restartServer = indep.restartServerIndependent;
  }

  return out;
}
