import { DomainDetail } from "@/components/DomainDetail";
import { isPremiumFeatureEnabled } from "@/lib/premium/server";
import { getSession } from "@/lib/session";
import { isDomainDisabled } from "@/lib/domain-utils";
import { getProvisioner } from "@/lib/provisioner";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ domain: string }> };

export default async function DomainDetailPage({ params }: Props) {
  const session = await getSession();
  if (!session) return null;

  const { domain: encoded } = await params;
  const domainName = decodeURIComponent(encoded);
  const domains = await getProvisioner().listDomains(session);
  const domain = domains.find(
    (d) => d.name.toLowerCase() === domainName.toLowerCase(),
  );
  if (!domain) notFound();

  const premiumPanelClient = await isPremiumFeatureEnabled("panel-client-vhost");

  return (
    <>
      <DomainDetail
        domain={domain}
        disabled={isDomainDisabled(domain)}
        isAdmin={session.role === "admin"}
        premiumPanelClient={premiumPanelClient}
      />
    </>
  );
}
