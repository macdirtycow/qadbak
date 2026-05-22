/**
 * Hosting provisioner abstraction (phase 2).
 * UI and API should call getProvisioner() — not import virtualmin.ts directly.
 */
export {
  getProvisioner,
  getProvisionerId,
  resetProvisioner,
} from "./resolve";
export { createVirtualminProvisioner } from "./virtualmin-adapter";
export { createHybridProvisioner } from "./hybrid-adapter";
export type { Provisioner, ProvisionerActor, ProvisionerId } from "./types";

/** @deprecated Import types from @/lib/provisioner or @/lib/virtualmin during migration */
export { VirtualMinError } from "../errors";
export type {
  VirtualMinDomain,
  VirtualMinMailbox,
  VirtualMinDatabase,
} from "../types";
export type {
  CreateDomainInput,
  DnsRecord,
  SslCert,
  MailAlias,
  UrlRedirect,
  ScheduledBackup,
  CronJob,
  ImapMailbox,
  FtpAccount,
  SharedAddress,
  BandwidthRow,
  ServerService,
  Reseller,
  AccountPlan,
  ServerTemplate,
  ExtraAdmin,
  S3Bucket,
  S3File,
  GlobalFeature,
  PhpVersion,
  PhpDirectory,
  PhpIniSetting,
  ProtectedDirectory,
  ProtectedUser,
  MailSecuritySettings,
  MailDomainSettings,
  DomainFeatureFlag,
  DomainLimits,
  AvailableScript,
  InstalledScript,
  ProxyRoute,
} from "../virtualmin";
