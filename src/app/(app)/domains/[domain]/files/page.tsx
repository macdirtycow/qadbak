import { FileManager } from "@/components/FileManager";
import { requireDomainAccess } from "@/lib/domain-api";
import { resolveDomainFilesListing } from "@/lib/domain-files-service";

type Props = { params: Promise<{ domain: string }> };

export default async function DomainFilesPage({ params }: Props) {
  const { session, domain } = await requireDomainAccess((await params).domain);
  const { listing, error } = await resolveDomainFilesListing(domain, "", session);
  return (
    <FileManager domain={domain} initialListing={listing} initialError={error} />
  );
}
