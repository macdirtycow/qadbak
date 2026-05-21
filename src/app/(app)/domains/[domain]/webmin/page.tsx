import { WebminHub } from "@/components/WebminHub";
import { requireDomainAccess } from "@/lib/domain-api";
import {
  userminUiBase,
  webminModulesForDomain,
  webminUiBase,
} from "@/lib/webmin";

type Props = { params: Promise<{ domain: string }> };

export default async function DomainWebminPage({ params }: Props) {
  const { domain } = await requireDomainAccess((await params).domain);
  const enc = encodeURIComponent(domain);
  return (
    <WebminHub
      title="Webmin & Usermin"
      description={`Virtualmin and Usermin for ${domain} — alongside Qadbak screens.`}
      modules={webminModulesForDomain()}
      linkApiPath={`/api/domains/${enc}/webmin-link`}
      webminBase={webminUiBase()}
      userminBase={userminUiBase()}
    />
  );
}
