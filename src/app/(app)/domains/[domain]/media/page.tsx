import { MediaLibraryManager } from "@/components/MediaLibraryManager";
import { requireDomainAccess } from "@/lib/domain-api";
import type { MediaLibraryStatus } from "@/lib/media-library";
import { runProvisioningHelper } from "@/lib/provisioner/native-exec";

type Props = { params: Promise<{ domain: string }> };

export default async function MediaLibraryPage({ params }: Props) {
  const { session, domain } = await requireDomainAccess((await params).domain);
  let status: MediaLibraryStatus = { installed: false };
  let error = "";
  try {
    const raw = await runProvisioningHelper("jellyfin-status", domain);
    status = {
      installed: Boolean(raw.installed),
      parentDomain: raw.parentDomain as string | undefined,
      subdomain: raw.subdomain as string | undefined,
      adminUrl: raw.adminUrl as string | undefined,
      mediaPath: raw.mediaPath as string | undefined,
      mediaPathRelative: raw.mediaPathRelative as string | undefined,
      mediaUsedBytes: raw.mediaUsedBytes as number | undefined,
      mediaFileCount: raw.mediaFileCount as number | undefined,
      diskLimitMb: raw.diskLimitMb as number | null | undefined,
      homeUsedBytes: raw.homeUsedBytes as number | undefined,
      containerStatus: raw.containerStatus as string | undefined,
      installedAt: raw.installedAt as string | undefined,
      installUrl: raw.installUrl as string | undefined,
    };
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not load media library.";
  }

  return (
    <MediaLibraryManager
      domain={domain}
      initialStatus={status}
      initialError={error}
      isAdmin={session.role === "admin"}
    />
  );
}
