import { ImapMailboxesManager } from "@/components/ImapMailboxesManager";
import { requireDomainAccess } from "@/lib/domain-api";
import { getProvisioner } from "@/lib/provisioner";

type Props = { params: Promise<{ domain: string; user: string }> };

export default async function WebmailPage({ params }: Props) {
  const { session, domain } = await requireDomainAccess((await params).domain);
  const isAdmin = session.role === "admin";
  const user = decodeURIComponent((await params).user);
  let mailboxes: Awaited<ReturnType<ReturnType<typeof getProvisioner>["listImapMailboxes"]>> = [];
  let error = "";
  try {
    mailboxes = await getProvisioner().listImapMailboxes(domain, user, session);
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not load mailboxes.";
  }

  return (
    <ImapMailboxesManager
      domain={domain}
      initialMailboxes={mailboxes}
      initialError={error}
      isAdmin={isAdmin}
      initialUser={user}
      webmailMode
    />
  );
}
