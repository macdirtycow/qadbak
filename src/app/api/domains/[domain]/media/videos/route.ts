import { handleApiError, jsonOk } from "@/lib/api";
import { requireDomainApi } from "@/lib/domain-api";
import { isPanelFilesMode } from "@/lib/domain-files";
import type { MediaVideoEntry } from "@/lib/media-library";
import { listMockMediaVideos } from "@/lib/media-videos-mock";
import { runProvisioningHelper } from "@/lib/provisioner/native-exec";

type Params = { params: Promise<{ domain: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { domain } = await requireDomainApi((await params).domain);

    if (isPanelFilesMode()) {
      const status = await runProvisioningHelper("jellyfin-status", domain);
      const mediaPathRelative = String(status.mediaPathRelative ?? "media");
      const videos = listMockMediaVideos(domain, mediaPathRelative);
      return jsonOk({
        parentDomain: status.parentDomain ?? domain,
        mediaPathRelative,
        videos,
      });
    }

    const raw = await runProvisioningHelper("jellyfin-list-videos", domain);
    return jsonOk({
      parentDomain: raw.parentDomain,
      mediaPathRelative: raw.mediaPathRelative,
      videos: (raw.videos as MediaVideoEntry[]) ?? [],
    });
  } catch (err) {
    return handleApiError(err);
  }
}
