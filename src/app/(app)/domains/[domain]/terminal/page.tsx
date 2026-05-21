import { WebminEmbed } from "@/components/WebminEmbed";
import { DomainPageHeader } from "@/components/DomainPageHeader";
import { requireDomainAccess } from "@/lib/domain-api";

type Props = { params: Promise<{ domain: string }> };

export default async function DomainTerminalPage({ params }: Props) {
  const { domain } = await requireDomainAccess((await params).domain);
  const enc = encodeURIComponent(domain);
  return (
    <div className="space-y-6">
      <DomainPageHeader domain={domain} title="Terminal" />
      <WebminEmbed
        title="Domain shell"
        description="Webmin xterm session scoped to this virtual server."
        fetchUrl={`/api/domains/${enc}/virtualmin-link?dest=terminal`}
        height="min(75vh, 800px)"
      />
    </div>
  );
}
