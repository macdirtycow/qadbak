import { requireDomainAccess } from "@/lib/domain-api";
import { getProvisioner } from "@/lib/provisioner";
import type { HostedMailbox } from "@/lib/types";
import Link from "next/link";

type Props = { params: Promise<{ domain: string }> };

type MailSection = {
  slug: string;
  title: string;
  description: string;
  adminOnly?: boolean;
};

const SECTIONS: MailSection[] = [
  {
    slug: "accounts",
    title: "Accounts",
    description: "Create mailboxes, passwords, and quotas",
  },
  {
    slug: "newsletter",
    title: "Newsletter",
    description: "Subscribers, campaigns, and signup forms",
  },
  {
    slug: "settings",
    title: "Settings",
    description: "Catch-all, autoresponder, and domain mail options",
  },
  {
    slug: "logs",
    title: "Logs",
    description: "Search delivery and server mail logs",
  },
  {
    slug: "imap",
    title: "IMAP",
    description: "Folders and advanced mailbox tools",
    adminOnly: true,
  },
];

export default async function MailHubPage({ params }: Props) {
  const { session, domain } = await requireDomainAccess((await params).domain);
  const isAdmin = session.role === "admin";
  const enc = encodeURIComponent(domain);
  const base = `/domains/${enc}/mail`;
  let users: HostedMailbox[] = [];
  let error = "";
  try {
    users = await getProvisioner().listMailboxes(domain, session);
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not load mailboxes.";
  }

  const sections = SECTIONS.filter((s) => !s.adminOnly || isAdmin);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-panel-accent/20 text-2xl">
          ✉
        </div>
        <h1 className="text-2xl font-semibold text-white">Mail</h1>
        <p className="mt-2 text-sm text-panel-muted">{domain}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {sections.map((s) => (
          <Link
            key={s.slug}
            href={`${base}/${s.slug}`}
            className="rounded-xl border border-panel-border bg-panel-card/50 px-4 py-3 transition hover:border-panel-accent"
          >
            <span className="font-medium text-white">{s.title}</span>
            <p className="mt-1 text-sm text-panel-muted">{s.description}</p>
          </Link>
        ))}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium text-panel-muted">Webmail</h2>
        {error && (
          <p className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
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
                  href={`${base}/${encodeURIComponent(name)}`}
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
            <Link href={`${base}/accounts`} className="text-panel-link hover:underline">
              Create one
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  );
}
