import { FileManager } from "@/components/FileManager";
import { requireDomainAccess } from "@/lib/domain-api";
import { resolveDomainFilesListing } from "@/lib/domain-files-service";
import { getUploadLimitInfo } from "@/lib/upload-limits-server";

type Props = {
  params: Promise<{ domain: string }>;
  searchParams: Promise<{ dir?: string }>;
};

export default async function DomainFilesPage({ params, searchParams }: Props) {
  const { session, domain } = await requireDomainAccess((await params).domain);
  const requestedDir = (await searchParams).dir;
  // Default to the document root because that's where 99% of file work
  // happens. Falls back to the account home if public_html doesn't yet
  // exist (new domain still provisioning) or the listing fails for any
  // reason. Explicit ?dir= in the URL always wins, including ?dir= to
  // request the home directory.
  const initialDir = requestedDir !== undefined ? requestedDir : "public_html";
  const [primary, uploadLimit] = await Promise.all([
    resolveDomainFilesListing(domain, initialDir, session),
    getUploadLimitInfo(),
  ]);
  let { listing, error } = primary;
  // Only fall back when public_html couldn't be listed at all (e.g.
  // brand-new domain whose helper hasn't created the dir yet). An
  // *empty* public_html is fine - user wants to land there to add
  // their first files.
  const shouldFallBack =
    requestedDir === undefined && initialDir === "public_html" && Boolean(error);
  if (shouldFallBack) {
    const fallback = await resolveDomainFilesListing(domain, "", session);
    listing = fallback.listing;
    error = fallback.error;
  }
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
