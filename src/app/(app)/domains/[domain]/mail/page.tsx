import { requireDomainAccess } from "@/lib/domain-api";
import { getProvisioner } from "@/lib/provisioner";
import type { VirtualMinMailbox } from "@/lib/types";
import Link from "next/link";

type Props = { params: Promise<{ domain: string }> };

export default async function WebmailHubPage({ params }: Props) {
  const { session, domain } = await requireDomainAccess((await params).domain);
  const enc = encodeURIComponent(domain);
  let users: VirtualMinMailbox[] = [];
  let error = "";
  try {
    users = await getProvisioner().listMailboxes(domain, session);
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not load mailboxes.";
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-panel-muted">
          <Link href={`/domains/${enc}`} className="hover:text-white">
            ← {domain}
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Webmail</h1>
        <p className="mt-1 text-sm text-panel-muted">
          Choose a mailbox to open in the browser. Manage accounts on the{" "}
          <Link href={`/domains/${enc}/email`} className="text-accent hover:underline">
            Email
          </Link>{" "}
          page.
        </p>
      </div>
      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}
      <ul className="divide-y divide-panel-border rounded-xl border border-panel-border">
        {users.map((u) => {
          const name = u.user ?? "";
          if (!name) return null;
          return (
            <li key={name}>
              <Link
                href={`/domains/${enc}/mail/${encodeURIComponent(name)}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-panel-border/20"
              >
                <span className="text-white">
                  {name}@{domain}
                  {u.real ? (
                    <span className="ml-2 text-sm text-panel-muted">{u.real}</span>
                  ) : null}
                </span>
                <span className="text-sm text-panel-accent">Open →</span>
              </Link>
            </li>
          );
        })}
      </ul>
      {users.length === 0 && !error && (
        <p className="text-center text-sm text-panel-muted">
          No mailboxes yet.{" "}
          <Link href={`/domains/${enc}/email`} className="text-accent hover:underline">
            Create one
          </Link>
          .
        </p>
      )}
    </div>
  );
}
