import { WebminEmbed } from "@/components/WebminEmbed";
import { DomainPageHeader } from "@/components/DomainPageHeader";
import { requireDomainAccess } from "@/lib/domain-api";
import { VIRTUALMIN_EMBED_PATHS } from "@/lib/virtualmin-embed";
import { createVirtualMinLoginLink } from "@/lib/virtualmin";

type Props = { params: Promise<{ domain: string }> };

export default async function DomainTerminalPage({ params }: Props) {
  const { domain, session } = await requireDomainAccess((await params).domain);
  const enc = encodeURIComponent(domain);

  let initialUrl: string | null = null;
  let initialError = "";
  try {
    initialUrl = await createVirtualMinLoginLink(domain, session, {
      redirectUrl: VIRTUALMIN_EMBED_PATHS.terminal,
      preferUsermin: false,
    });
  } catch (e) {
    initialError =
      e instanceof Error
        ? e.message
        : "Could not open terminal. Use Webmin → Terminal (xterm) or run Repair on Overview.";
  }

  return (
    <div className="space-y-6">
      <DomainPageHeader domain={domain} title="Terminal" />
      <WebminEmbed
        title="Domain shell"
        description="Webmin xterm session scoped to this virtual server."
        fetchUrl={`/api/domains/${enc}/virtualmin-link?dest=terminal`}
        initialUrl={initialUrl}
        initialError={initialError || undefined}
        height="min(75vh, 800px)"
      />
    </div>
  );
}
