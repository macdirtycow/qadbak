import { DomainTerminal } from "@/components/DomainTerminal";
import { DomainPageHeader } from "@/components/DomainPageHeader";
import { requireDomainAccess } from "@/lib/domain-api";

type Props = { params: Promise<{ domain: string }> };

export default async function DomainTerminalPage({ params }: Props) {
  const { domain } = await requireDomainAccess((await params).domain);
  const enc = encodeURIComponent(domain);

  return (
    <div className="space-y-6">
      <DomainPageHeader domain={domain} title="Terminal" />
      <DomainTerminal
        domain={domain}
        fetchUrl={`/api/domains/${enc}/terminal/ws-token`}
        subtitle={`Commands run as the domain unix user (not root). Server-wide shell: Server admin → Terminal.`}
      />
    </div>
  );
}
