import { NewsletterManager } from "@/components/NewsletterManager";
import { requireDomainAccess } from "@/lib/domain-api";
import { getProvisioner } from "@/lib/provisioner";

type Props = { params: Promise<{ domain: string }> };

export default async function MailNewsletterPage({ params }: Props) {
  const { session, domain } = await requireDomainAccess((await params).domain);
  const isAdmin = session.role === "admin";
  let mailboxes: string[] = [];
  let error = "";
  try {
    const users = await getProvisioner().listMailboxes(domain, session);
    mailboxes = users.map((u) => u.user).filter((u): u is string => !!u);
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not load mailboxes.";
  }

  return (
    <NewsletterManager
      domain={domain}
      initialMailboxes={mailboxes}
      isAdmin={isAdmin}
      initialError={error}
    />
  );
}
