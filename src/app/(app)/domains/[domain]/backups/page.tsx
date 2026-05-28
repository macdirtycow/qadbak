import { BackupsManager } from "@/components/BackupsManager";
import { requireDomainAccess } from "@/lib/domain-api";
import { getProvisioner } from "@/lib/provisioner";
import { nativeFeatureEnabled } from "@/lib/provisioner/native-features";
import { isIndependentMode } from "@/lib/provisioner/native-stub";

type Props = { params: Promise<{ domain: string }> };

export default async function BackupsPage({ params }: Props) {
  const { session, domain } = await requireDomainAccess((await params).domain);
  let scheduled: Awaited<ReturnType<ReturnType<typeof getProvisioner>["listScheduledBackups"]>> = [];
  let error = "";
  try {
    scheduled = await getProvisioner().listScheduledBackups(domain, session);
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not load backups.";
  }
  const nativeMode = nativeFeatureEnabled("backup") || isIndependentMode();

  const isAdmin = session.role === "admin";

  return (
    <BackupsManager
      domain={domain}
      initialScheduled={scheduled}
      canBackup
      canRestore={isAdmin}
      canPartialRestore={nativeMode}
      canUpload={isAdmin && nativeMode}
      nativeMode={nativeMode}
      isAdmin={isAdmin}
      initialError={error}
    />
  );
}
