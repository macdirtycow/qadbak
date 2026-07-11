import { auditLog } from "@/lib/audit";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import { requireDomainApi } from "@/lib/domain-api";
import type { MediaLibraryStatus } from "@/lib/media-library";
import { runProvisioningHelper } from "@/lib/provisioner/native-exec";

type Params = { params: Promise<{ domain: string }> };

function mapStatus(raw: Record<string, unknown>): MediaLibraryStatus {
  return {
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
    message: raw.message as string | undefined,
  };
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const { domain } = await requireDomainApi((await params).domain);
    const raw = await runProvisioningHelper("jellyfin-status", domain);
    return jsonOk(mapStatus(raw));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { session, domain } = await requireDomainApi((await params).domain);
    if (session.role !== "admin") {
      return jsonError("Only administrators can change the media folder.", 403);
    }
    const body = (await request.json()) as { mediaPath?: string };
    const mediaPath = body.mediaPath?.trim();
    if (!mediaPath) return jsonError("mediaPath is required.");

    const raw = await runProvisioningHelper(
      "jellyfin-set-media-path",
      domain,
      JSON.stringify({ mediaPath }),
    );
    await auditLog(session.username, "media-library-path", domain, mediaPath);
    return jsonOk(mapStatus(raw));
  } catch (err) {
    return handleApiError(err);
  }
}
