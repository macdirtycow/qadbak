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
