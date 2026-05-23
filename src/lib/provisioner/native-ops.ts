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
  const type =
    input.type ?? (input.alias ? "alias" : input.subdom ? "sub" : "top");
  const extra = JSON.stringify({
    type,
    parent: input.parent,
    plan: input.plan,
  });
  await runProvisioningHelper(
    "domain-create",
    input.domain,
    input.pass,
    input.user?.trim() || "",
    extra,
  );
}

export async function deleteDomainNative(
  domain: string,
  _actor: Actor,
): Promise<void> {
  await runProvisioningHelper("domain-delete", domain);
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export async function listScheduledBackupsNative(
  domain: string,
  _actor: Actor,
): Promise<ScheduledBackup[]> {
  const r = await runProvisioningHelper("backup-list", domain);
  const files =
    (r.backups as { name: string; sizeBytes?: number; modified?: string; kind?: string }[]) ??
    [];
  const sched = r.schedule as
    | { schedule?: string; enabled?: boolean; retain?: number }
    | undefined;
  const rows: ScheduledBackup[] = [];
  if (sched) {
    rows.push({
      id: "schedule",
      schedule: sched.schedule ?? "0 3 * * *",
      dest: `Automatic · keep ${sched.retain ?? 7} backups`,
      enabled: sched.enabled ? "1" : "0",
    });
  }
  for (const f of files) {
    rows.push({
      id: f.name,
      schedule: f.kind === "scheduled" ? "Scheduled" : "Manual",
      dest: `${formatBytes(f.sizeBytes ?? 0)} · ${f.name}`,
      enabled: "1",
    });
  }
  return rows;
}

export async function startBackupNative(
  domain: string,
  _actor: Actor,
): Promise<{ file?: string; components?: string[] }> {
  const r = await runProvisioningHelper("backup-create", domain, "full");
  return {
    file: r.file as string | undefined,
    components: r.components as string[] | undefined,
  };
}

export async function restoreDomainNative(
  domain: string,
  source: string,
  opts: { test?: boolean; allFeatures?: boolean },
  _actor: Actor,
): Promise<{ restored?: string[]; preview?: string[]; test?: boolean }> {
  const r = await runProvisioningHelper(
    "backup-restore",
    domain,
    source,
    opts.test ? "true" : "false",
  );
  return {
    restored: r.restored as string[] | undefined,
    preview: r.preview as string[] | undefined,
    test: Boolean(r.test),
  };
}

export async function modifyScheduledBackupNative(
  domain: string,
  id: string,
  opts: { enabled?: boolean },
  _actor: Actor,
): Promise<void> {
  if (id === "schedule") {
    await runProvisioningHelper(
      "backup-schedule-toggle",
      domain,
      opts.enabled ? "true" : "false",
    );
    return;
  }
  throw new Error("Only the automatic schedule can be enabled or disabled.");
}

export async function deleteBackupNative(
  domain: string,
  name: string,
  _actor: Actor,
): Promise<void> {
  await runProvisioningHelper("backup-delete", domain, name);
}

export async function setBackupScheduleNative(
  domain: string,
  schedule: { schedule?: string; enabled?: boolean; retain?: number },
  _actor: Actor,
): Promise<void> {
  await runProvisioningHelper(
    "backup-schedule-set",
    domain,
    JSON.stringify(schedule),
  );
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
  mailboxUser?: string,
): Promise<void> {
  await runProvisioningHelper("imap-copy", domain, from, to, mailboxUser ?? "");
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

export async function listProtectedUsersNative(
  domain: string,
  dirPath: string,
  _actor: Actor,
): Promise<{ user: string; path?: string }[]> {
  const r = await runProvisioningHelper("protected-users-list", domain, dirPath);
  return (r.users as { user: string }[]) ?? [];
}

export async function createProtectedUserNative(
  domain: string,
  dirPath: string,
  user: string,
  pass: string,
  _actor: Actor,
): Promise<void> {
  await runProvisioningHelper("protected-user-create", domain, dirPath, user, pass);
}

export async function deleteProtectedUserNative(
  domain: string,
  dirPath: string,
  user: string,
  _actor: Actor,
): Promise<void> {
  await runProvisioningHelper("protected-user-delete", domain, dirPath, user);
}

export async function resendEmailNative(
  _domain: string,
  _messageId: string,
  _actor: Actor,
): Promise<void> {
  throw new Error(
    "Resend is not available in native mode. Resend from your mail client or use the server mail queue.",
  );
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

export async function listProxiesNative(
  domain: string,
  _actor: Actor,
): Promise<{ path: string; dest: string; type?: string }[]> {
  const r = await runProvisioningHelper("proxy-list", domain);
  return (r.proxies as { path: string; dest: string; type?: string }[]) ?? [];
}

export async function createProxyNative(
  domain: string,
  path: string,
  dest: string,
  _actor: Actor,
): Promise<void> {
  await runProvisioningHelper("proxy-create", domain, path, dest, "proxy");
}

export async function deleteProxyNative(
  domain: string,
  path: string,
  _actor: Actor,
): Promise<void> {
  await runProvisioningHelper("proxy-delete", domain, path);
}

export async function listAvailableScriptsNative(
  domain: string,
  _actor: Actor,
): Promise<{ name: string; desc?: string; version?: string }[]> {
  const r = await runProvisioningHelper("script-available", domain);
  return (r.available as { name: string; desc?: string; version?: string }[]) ?? [];
}

export async function listInstalledScriptsNative(
  domain: string,
  _actor: Actor,
): Promise<{ name: string; version?: string; path?: string; url?: string }[]> {
  const r = await runProvisioningHelper("script-list", domain);
  return ((r.installed as { name: string; path?: string }[]) ?? []).map((s) => ({
    name: s.name,
    path: s.path,
    version: "native",
  }));
}

export async function installScriptNative(
  domain: string,
  script: string,
  installPath: string | undefined,
  _actor: Actor,
): Promise<void> {
  await runProvisioningHelper("script-install", domain, script, installPath ?? "public_html");
}

export async function deleteInstalledScriptNative(
  domain: string,
  script: string,
  _actor: Actor,
): Promise<void> {
  await runProvisioningHelper("script-delete", domain, script);
}

export async function getMailSecurityNative(
  domain: string,
  _actor: Actor,
): Promise<{ spamEnabled?: boolean; dkimEnabled?: boolean }> {
  const r = await runProvisioningHelper("security-get", domain);
  return (r.settings as { spamEnabled?: boolean; dkimEnabled?: boolean }) ?? {};
}

export async function setSpamFilterNative(
  domain: string,
  enabled: boolean,
  _actor: Actor,
): Promise<void> {
  await runProvisioningHelper("security-spam", domain, enabled ? "true" : "false");
}

export async function setDkimNative(
  domain: string,
  enabled: boolean,
  _actor: Actor,
): Promise<void> {
  await runProvisioningHelper("security-dkim", domain, enabled ? "true" : "false");
}

export async function listResellersNative(
  _actor: Actor,
): Promise<{ name: string; domains?: string; limit?: string }[]> {
  const r = await runProvisioningHelper("reseller-list");
  return (r.resellers as { name: string; domains?: string; limit?: string }[]) ?? [];
}

export async function createResellerNative(
  name: string,
  pass: string,
  _actor: Actor,
): Promise<void> {
  await runProvisioningHelper("reseller-create", name, pass);
}

export async function deleteResellerNative(
  name: string,
  _actor: Actor,
): Promise<void> {
  await runProvisioningHelper("reseller-delete", name);
}

export async function listPlansNative(
  _actor: Actor,
): Promise<{ name: string; id?: string; quota?: string }[]> {
  const r = await runProvisioningHelper("plan-list");
  return (r.plans as { name: string; id?: string; quota?: string }[]) ?? [];
}

export async function createPlanNative(
  name: string,
  _actor: Actor,
): Promise<void> {
  await runProvisioningHelper("plan-create", name);
}

export async function deletePlanNative(
  name: string,
  _actor: Actor,
): Promise<void> {
  await runProvisioningHelper("plan-delete", name);
}
