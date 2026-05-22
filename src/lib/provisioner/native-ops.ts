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
