import type { Role } from "../types";
import type {
  BandwidthRow,
  ExtraAdmin,
  GlobalFeature,
  ServerTemplate,
  S3Bucket,
  S3File,
  ServerService,
} from "../virtualmin";
import {
  controlNativeServerService,
  listNativeBandwidth,
  listNativeServerServices,
  probeHostServicesSudo,
} from "../host-services-sudo";
import { runProvisioningHelper } from "./native-exec";

type Actor = { role: Role; domains: string[] };

export async function cloneDomainIndependent(
  source: string,
  newDomain: string,
  _actor: Actor,
): Promise<void> {
  await runProvisioningHelper("domain-clone", source, newDomain);
}

export async function migrateDomainIndependent(
  domain: string,
  destHost: string,
  _actor: Actor,
): Promise<void> {
  await runProvisioningHelper("domain-migrate", domain, destHost);
}

export async function transferDomainIndependent(
  domain: string,
  newOwner: string,
  _actor: Actor,
): Promise<void> {
  await runProvisioningHelper("domain-transfer", domain, newOwner);
}

export async function checkServerConfigIndependent(
  _actor: Actor,
): Promise<string> {
  const r = await runProvisioningHelper("admin-check-config");
  return String(r.message ?? "Configuration checked.");
}

export async function getLicenseInfoIndependent(
  _actor: Actor,
): Promise<Record<string, string>> {
  const r = await runProvisioningHelper("admin-license");
  return (r.license as Record<string, string>) ?? {};
}

export async function listTemplatesIndependent(
  _actor: Actor,
): Promise<ServerTemplate[]> {
  const r = await runProvisioningHelper("admin-templates");
  return (r.templates as ServerTemplate[]) ?? [];
}

export async function listAdminsIndependent(_actor: Actor): Promise<ExtraAdmin[]> {
  const r = await runProvisioningHelper("admin-admins-list");
  return (r.admins as ExtraAdmin[]) ?? [];
}

export async function createAdminIndependent(
  user: string,
  pass: string,
  _actor: Actor,
): Promise<void> {
  await runProvisioningHelper("admin-admins-create", user, pass);
}

export async function deleteAdminIndependent(
  user: string,
  _actor: Actor,
): Promise<void> {
  await runProvisioningHelper("admin-admins-delete", user);
}

export async function listGlobalFeaturesIndependent(
  _actor: Actor,
): Promise<GlobalFeature[]> {
  const r = await runProvisioningHelper("admin-global-features");
  return (r.features as GlobalFeature[]) ?? [];
}

export async function setGlobalFeatureIndependent(
  feature: string,
  enabled: boolean,
  _actor: Actor,
): Promise<void> {
  await runProvisioningHelper(
    "admin-global-feature-set",
    feature,
    enabled ? "true" : "false",
  );
}

export async function runConfigSystemIndependent(
  bundle: string,
  _actor: Actor,
): Promise<unknown> {
  const r = await runProvisioningHelper("admin-config-system", bundle);
  return r.result ?? r.message ?? { ok: true };
}

export async function listS3BucketsIndependent(
  accessKey: string,
  secretKey: string,
  _actor: Actor,
): Promise<S3Bucket[]> {
  const r = await runProvisioningHelper("admin-s3-buckets", accessKey, secretKey);
  return (r.buckets as S3Bucket[]) ?? [];
}

export async function listS3FilesIndependent(
  bucket: string,
  accessKey: string,
  secretKey: string,
  _actor: Actor,
): Promise<S3File[]> {
  const r = await runProvisioningHelper(
    "admin-s3-files",
    bucket,
    accessKey,
    secretKey,
  );
  return (r.files as S3File[]) ?? [];
}

export async function uploadS3FileIndependent(
  opts: {
    bucket: string;
    key: string;
    accessKey: string;
    secretKey: string;
    source?: string;
  },
  _actor: Actor,
): Promise<unknown> {
  return runProvisioningHelper(
    "admin-s3-upload",
    opts.bucket,
    opts.key,
    opts.accessKey,
    opts.secretKey,
    opts.source ?? "",
  );
}

export type NativeServerStatus = {
  mode: string;
  provisioner: string;
  virtualminConfigured: boolean;
  domainCount: number;
  domains: string[];
  services: { name: string; status: string }[];
  nginxTest: string;
};

const HOST_HINT =
  "sudo bash /opt/qadbak/scripts/configure-host-services-sudo.sh";

async function requireHostServices(): Promise<void> {
  if (!(await probeHostServicesSudo())) {
    throw new Error(`Host services sudo not configured. Run: ${HOST_HINT}`);
  }
}

export async function listBandwidthIndependent(
  _actor: Actor,
): Promise<BandwidthRow[]> {
  await requireHostServices();
  return listNativeBandwidth();
}

export async function listServerStatusesIndependent(
  _actor: Actor,
): Promise<ServerService[]> {
  await requireHostServices();
  return listNativeServerServices();
}

export async function restartServerIndependent(
  service: string,
  _actor: Actor,
): Promise<void> {
  await requireHostServices();
  await controlNativeServerService(service, "restart");
}

export async function getNativeServerStatus(): Promise<NativeServerStatus> {
  const r = await runProvisioningHelper("admin-server-status");
  return {
    mode: String(r.mode ?? "native"),
    provisioner: String(r.provisioner ?? "native"),
    virtualminConfigured: Boolean(r.virtualminConfigured),
    domainCount: Number(r.domainCount ?? 0),
    domains: (r.domains as string[]) ?? [],
    services: (r.services as { name: string; status: string }[]) ?? [],
    nginxTest: String(r.nginxTest ?? "unknown"),
  };
}
