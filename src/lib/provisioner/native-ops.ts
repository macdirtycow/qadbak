import type { Role, VirtualMinDatabase, VirtualMinMailbox } from "../types";
import type {
  CronJob,
  DnsRecord,
  ScheduledBackup,
  SslCert,
  CreateDomainInput,
} from "../virtualmin";
import { runProvisioningHelper } from "./native-exec";

type Actor = { role: Role; domains: string[] };

export async function listSslCertsNative(
  domain: string,
  _actor: Actor,
): Promise<SslCert[]> {
  const r = await runProvisioningHelper("ssl-list", domain);
  return (r.certs as SslCert[]) ?? [];
}

export async function requestLetsEncryptNative(
  domain: string,
  host: string,
  _actor: Actor,
): Promise<void> {
  await runProvisioningHelper("ssl-issue", domain, host || domain);
}

export async function getDnsNative(
  domain: string,
  _actor: Actor,
): Promise<{ records: DnsRecord[]; raw: unknown }> {
  const r = await runProvisioningHelper("dns-get", domain);
  return { records: (r.records as DnsRecord[]) ?? [], raw: r };
}

export async function addDnsRecordNative(
  domain: string,
  record: DnsRecord,
  _actor: Actor,
): Promise<void> {
  await runProvisioningHelper("dns-add", domain, JSON.stringify(record));
}

export async function deleteDnsRecordNative(
  domain: string,
  record: DnsRecord,
  _actor: Actor,
): Promise<void> {
  await runProvisioningHelper("dns-del", domain, JSON.stringify(record));
}

export async function listMailboxesNative(
  domain: string,
  _actor: Actor,
): Promise<VirtualMinMailbox[]> {
  const r = await runProvisioningHelper("mail-list", domain);
  return ((r.mailboxes as { user: string; real?: string }[]) ?? []).map((m) => ({
    user: m.user,
    name: m.user,
    real: m.real,
  })) as VirtualMinMailbox[];
}

export async function createMailboxNative(
  domain: string,
  user: string,
  pass: string,
  real: string | undefined,
  _actor: Actor,
): Promise<void> {
  await runProvisioningHelper(
    "mail-create",
    domain,
    user,
    pass,
    real ?? "",
  );
}

export async function updateMailboxPasswordNative(
  domain: string,
  user: string,
  pass: string,
  _actor: Actor,
): Promise<void> {
  await runProvisioningHelper("mail-pass", domain, user, pass);
}

export async function deleteMailboxNative(
  domain: string,
  user: string,
  _actor: Actor,
): Promise<void> {
  await runProvisioningHelper("mail-delete", domain, user);
}

export async function listDatabasesNative(
  domain: string,
  _actor: Actor,
): Promise<VirtualMinDatabase[]> {
  const r = await runProvisioningHelper("db-list", domain);
  return (r.databases as VirtualMinDatabase[]) ?? [];
}

export async function createDatabaseNative(
  domain: string,
  name: string,
  pass: string,
  _type: string,
  _actor: Actor,
): Promise<void> {
  await runProvisioningHelper("db-create", domain, name, pass);
}

export async function updateDatabasePasswordNative(
  domain: string,
  name: string,
  pass: string,
  _actor: Actor,
): Promise<void> {
  await runProvisioningHelper("db-pass", domain, name, pass);
}

export async function createDomainNative(
  input: CreateDomainInput,
  _actor: Actor,
): Promise<void> {
  await runProvisioningHelper(
    "domain-create",
    input.domain,
    input.pass,
    input.user?.trim() || "",
  );
}

export async function deleteDomainNative(
  domain: string,
  _actor: Actor,
): Promise<void> {
  await runProvisioningHelper("domain-delete", domain);
}

export async function listScheduledBackupsNative(
  domain: string,
  _actor: Actor,
): Promise<ScheduledBackup[]> {
  const r = await runProvisioningHelper("backup-list", domain);
  const files = (r.backups as { name: string }[]) ?? [];
  return files.map((f, i) => ({
    id: String(i),
    schedule: "manual",
    dest: f.name,
    enabled: "1",
  }));
}

export async function startBackupNative(
  domain: string,
  _actor: Actor,
): Promise<unknown> {
  return runProvisioningHelper("backup-create", domain);
}

export async function listCronJobsNative(
  domain: string,
  _actor: Actor,
): Promise<CronJob[]> {
  const r = await runProvisioningHelper("cron-list", domain);
  return ((r.jobs as { schedule: string; command: string }[]) ?? []).map(
    (j, i) => ({
      id: String(i),
      schedule: j.schedule,
      command: j.command,
      active: true,
    }),
  );
}

export async function createCronJobNative(
  domain: string,
  schedule: string,
  command: string,
  _user: string | undefined,
  _actor: Actor,
): Promise<void> {
  await runProvisioningHelper("cron-create", domain, schedule, command);
}

export async function deleteCronJobNative(
  domain: string,
  id: string,
  _actor: Actor,
): Promise<void> {
  await runProvisioningHelper("cron-delete", domain, id);
}

export async function listAliasesNative(
  domain: string,
  _actor: Actor,
): Promise<{ from: string; to: string }[]> {
  const r = await runProvisioningHelper("alias-list", domain);
  return (r.aliases as { from: string; to: string }[]) ?? [];
}

export async function createAliasNative(
  domain: string,
  from: string,
  to: string,
  _actor: Actor,
): Promise<void> {
  await runProvisioningHelper("alias-create", domain, from, to);
}

export async function deleteAliasNative(
  domain: string,
  from: string,
  _actor: Actor,
): Promise<void> {
  await runProvisioningHelper("alias-delete", domain, from);
}

export async function listRedirectsNative(
  domain: string,
  _actor: Actor,
): Promise<{ path: string; dest: string; type?: string }[]> {
  const r = await runProvisioningHelper("redirect-list", domain);
  return (r.redirects as { path: string; dest: string; type?: string }[]) ?? [];
}

export async function createRedirectNative(
  domain: string,
  path: string,
  dest: string,
  type: string,
  _actor: Actor,
): Promise<void> {
  await runProvisioningHelper("redirect-create", domain, path, dest, type || "301");
}

export async function deleteRedirectNative(
  domain: string,
  path: string,
  _actor: Actor,
): Promise<void> {
  await runProvisioningHelper("redirect-delete", domain, path);
}

export async function listDomainFeaturesNative(
  domain: string,
  _actor: Actor,
): Promise<{ feature: string; enabled: boolean; label?: string }[]> {
  const r = await runProvisioningHelper("feature-list", domain);
  return (r.features as { feature: string; enabled: boolean; label?: string }[]) ?? [];
}

export async function setDomainFeatureNative(
  domain: string,
  feature: string,
  enabled: boolean,
  _actor: Actor,
): Promise<void> {
  await runProvisioningHelper("feature-set", domain, feature, enabled ? "true" : "false");
}

export async function getWebsiteLogsNative(
  domain: string,
  logType: "access" | "error",
  _actor: Actor,
): Promise<string> {
  const r = await runProvisioningHelper("logs-tail", domain, logType);
  return String(r.log ?? "");
}

export async function listPhpVersionsNative(
  domain: string,
  _actor: Actor,
): Promise<{ version: string; id?: string }[]> {
  const r = await runProvisioningHelper("php-versions", domain);
  return (r.versions as { version: string; id?: string }[]) ?? [];
}

export async function listPhpDirectoriesNative(
  domain: string,
  _actor: Actor,
): Promise<{ dir: string; version?: string; mode?: string }[]> {
  const r = await runProvisioningHelper("php-directories", domain);
  return (r.directories as { dir: string; version?: string; mode?: string }[]) ?? [];
}

export async function listPhpIniNative(
  domain: string,
  version: string | undefined,
  _actor: Actor,
): Promise<{ name: string; value: string }[]> {
  const r = await runProvisioningHelper("php-ini", domain, version ?? "");
  return (r.ini as { name: string; value: string }[]) ?? [];
}

export async function setPhpDirectoryNative(
  domain: string,
  dir: string,
  version: string,
  _actor: Actor,
): Promise<void> {
  await runProvisioningHelper("php-set-directory", domain, dir, version);
}

export async function listFtpAccountsSafeNative(
  domain: string,
  _actor: Actor,
): Promise<{ user: string; dir?: string; quota?: string }[]> {
  const r = await runProvisioningHelper("ftp-list", domain);
  return (r.accounts as { user: string; dir?: string; quota?: string }[]) ?? [];
}

export async function createFtpAccountNative(
  domain: string,
  user: string,
  pass: string,
  _actor: Actor,
): Promise<void> {
  await runProvisioningHelper("ftp-create", domain, user, pass);
}

export async function updateFtpPasswordNative(
  domain: string,
  user: string,
  pass: string,
  _actor: Actor,
): Promise<void> {
  await runProvisioningHelper("ftp-pass", domain, user, pass);
}

export async function deleteFtpAccountNative(
  domain: string,
  user: string,
  _actor: Actor,
): Promise<void> {
  await runProvisioningHelper("ftp-delete", domain, user);
}

export async function getDomainLimitsNative(
  domain: string,
  _actor: Actor,
): Promise<{
  disk?: string;
  bandwidth?: string;
  mailboxes?: string;
  databases?: string;
}> {
  const r = await runProvisioningHelper("limits-get", domain);
  return (r.limits as {
    disk?: string;
    bandwidth?: string;
    mailboxes?: string;
    databases?: string;
  }) ?? {};
}

export async function updateDomainLimitsNative(
  domain: string,
  limits: {
    disk?: string;
    bandwidth?: string;
    mailboxes?: string;
    databases?: string;
  },
  _actor: Actor,
): Promise<void> {
  await runProvisioningHelper("limits-set", domain, JSON.stringify(limits));
}

export async function setDomainEnabledNative(
  domain: string,
  enabled: boolean,
  _actor: Actor,
): Promise<void> {
  await runProvisioningHelper(
    enabled ? "domain-enable" : "domain-disable",
    domain,
  );
}

export async function validateDomainNative(
  domain: string,
  _actor: Actor,
): Promise<{ valid: boolean; messages: string[] }> {
  const r = await runProvisioningHelper("domain-validate", domain);
  return {
    valid: Boolean(r.valid),
    messages: (r.messages as string[]) ?? [],
  };
}

export async function searchMailLogsNative(
  domain: string,
  query: string,
  _actor: Actor,
): Promise<string[]> {
  const r = await runProvisioningHelper("mail-logs-search", domain, query);
  return (r.lines as string[]) ?? [];
}

export async function listImapMailboxesNative(
  domain: string,
  user: string | undefined,
  _actor: Actor,
): Promise<{ user: string; folder: string; messages?: string; size?: string }[]> {
  const r = await runProvisioningHelper("imap-list", domain, user ?? "");
  return (r.mailboxes as { user: string; folder: string; messages?: string; size?: string }[]) ?? [];
}

export async function copyMailboxNative(
  domain: string,
  from: string,
  to: string,
  _actor: Actor,
): Promise<void> {
  await runProvisioningHelper("imap-copy", domain, from, to);
}

export async function listProtectedDirectoriesNative(
  domain: string,
  _actor: Actor,
): Promise<{ path: string; id?: string }[]> {
  const r = await runProvisioningHelper("protected-list", domain);
  return (r.directories as { path: string; id?: string }[]) ?? [];
}

export async function createProtectedDirectoryNative(
  domain: string,
  dirPath: string,
  _actor: Actor,
): Promise<void> {
  await runProvisioningHelper("protected-create", domain, dirPath);
}

export async function deleteProtectedDirectoryNative(
  domain: string,
  dirPath: string,
  _actor: Actor,
): Promise<void> {
  await runProvisioningHelper("protected-delete", domain, dirPath);
}

export async function listSharedAddressesNative(
  domain: string,
  _actor: Actor,
): Promise<{ address: string; users: string }[]> {
  const r = await runProvisioningHelper("shared-list", domain);
  return (r.addresses as { address: string; users: string }[]) ?? [];
}

export async function createSharedAddressNative(
  domain: string,
  address: string,
  users: string,
  _actor: Actor,
): Promise<void> {
  await runProvisioningHelper("shared-create", domain, address, users);
}

export async function deleteSharedAddressNative(
  domain: string,
  address: string,
  _actor: Actor,
): Promise<void> {
  await runProvisioningHelper("shared-delete", domain, address);
}

export async function getMailSettingsNative(
  domain: string,
  _actor: Actor,
): Promise<{
  catchAll?: string;
  autoresponder?: string;
  autoresponderEnabled?: boolean;
}> {
  const r = await runProvisioningHelper("mail-settings-get", domain);
  return (r.settings as {
    catchAll?: string;
    autoresponder?: string;
    autoresponderEnabled?: boolean;
  }) ?? {};
}

export async function updateMailSettingsNative(
  domain: string,
  settings: {
    catchAll?: string;
    autoresponder?: string;
    autoresponderEnabled?: boolean;
  },
  _actor: Actor,
): Promise<void> {
  await runProvisioningHelper("mail-settings-set", domain, JSON.stringify(settings));
}
