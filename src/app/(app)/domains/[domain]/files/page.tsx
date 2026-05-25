import { FileManager } from "@/components/FileManager";
import { requireDomainAccess } from "@/lib/domain-api";
import { resolveDomainFilesListing } from "@/lib/domain-files-service";
import { getUploadLimitInfo } from "@/lib/upload-limits-server";

type Props = { params: Promise<{ domain: string }> };

export default async function DomainFilesPage({ params }: Props) {
  const { session, domain } = await requireDomainAccess((await params).domain);
  const [{ listing, error }, uploadLimit] = await Promise.all([
    resolveDomainFilesListing(domain, "", session),
    getUploadLimitInfo(),
  ]);
  return (
    <FileManager
      domain={domain}
      initialListing={listing}
      initialError={error}
      maxUploadBytes={uploadLimit.maxBytes}
      uploadPremium={uploadLimit.premium}
    />
  );
}
