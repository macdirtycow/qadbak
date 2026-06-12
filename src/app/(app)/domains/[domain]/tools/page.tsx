import { PanelToolsManager } from "@/components/PanelToolsManager";
import { requireDomainAccess } from "@/lib/domain-api";
import { getProvisioner } from "@/lib/provisioner";

type Props = { params: Promise<{ domain: string }> };

export default async function DomainToolsPage({ params }: Props) {
  const { session, domain } = await requireDomainAccess((await params).domain);
  let mailboxes: string[] = [];
  try {
    const users = await getProvisioner().listMailboxes(domain, session);
    mailboxes = users.map((u) => u.user).filter((u): u is string => !!u);
  } catch {
    mailboxes = ["info"];
  }
  return (
    <PanelToolsManager
      domain={domain}
      initialMailboxes={mailboxes}
      isAdmin={session.role === "admin"}
    />
  );
}
