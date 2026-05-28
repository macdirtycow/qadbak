import { RuntimesManager } from "@/components/RuntimesManager";
import { requireDomainAccess } from "@/lib/domain-api";
import { getProvisioner } from "@/lib/provisioner";

type Props = { params: Promise<{ domain: string }> };

export default async function RuntimesPage({ params }: Props) {
  const { session, domain } = await requireDomainAccess((await params).domain);
  let runtimes: { apps?: { type: string; name: string; port?: number; path?: string }[] } = {
    apps: [],
  };
  let phpFpmSocket = "";
  let error = "";
  try {
    const raw = await getProvisioner().getRuntimes(domain, session);
    runtimes =
      (raw.runtimes as {
        apps?: { type: string; name: string; port?: number; path?: string }[];
      }) ?? { apps: [] };
    phpFpmSocket = String(raw.phpFpmSocket ?? "");
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not load runtimes.";
  }
  return (
    <RuntimesManager
      domain={domain}
      initialRuntimes={runtimes}
      phpFpmSocket={phpFpmSocket}
      initialError={error}
      isAdmin={session.role === "admin"}
    />
  );
}
