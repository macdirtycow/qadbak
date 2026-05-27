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
    <div className="mx-auto max-w-lg space-y-6">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-panel-accent/20 text-2xl">
          ✉
        </div>
        <h1 className="text-2xl font-semibold text-white">Qadbak Mail</h1>
        <p className="mt-2 text-sm text-panel-muted">
          <Link href={`/domains/${enc}`} className="hover:text-white">
            {domain}
          </Link>
          {" · "}
          <Link href={`/domains/${enc}/email`} className="text-panel-link hover:underline">
            Manage accounts
          </Link>
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

      <ul className="overflow-hidden rounded-xl border border-panel-border bg-panel-card/50 divide-y divide-panel-border">
        {users.map((u) => {
          const name = u.user ?? "";
          if (!name) return null;
          return (
            <li key={name}>
              <Link
                href={`/domains/${enc}/mail/${encodeURIComponent(name)}`}
                className="flex items-center gap-4 px-5 py-4 transition hover:bg-white/[0.04]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-700 text-sm font-semibold text-slate-200">
                  {name.slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-white">
                    {name}@{domain}
                  </span>
                  {u.real ? (
                    <span className="block truncate text-sm text-panel-muted">
                      {u.real}
                    </span>
                  ) : null}
                </span>
                <span className="text-sm text-panel-link">Open</span>
              </Link>
            </li>
          );
        })}
      </ul>

      {users.length === 0 && !error && (
        <p className="text-center text-sm text-panel-muted">
          No mailboxes yet.{" "}
          <Link href={`/domains/${enc}/email`} className="text-panel-link hover:underline">
            Create one
          </Link>
          .
        </p>
      )}
    </div>
  );
}
