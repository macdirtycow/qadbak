"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type MailTab = { slug: string; label: string; adminOnly?: boolean };

const TABS: MailTab[] = [
  { slug: "", label: "Overview" },
  { slug: "accounts", label: "Accounts" },
  { slug: "newsletter", label: "Newsletter" },
  { slug: "settings", label: "Settings" },
  { slug: "logs", label: "Logs" },
  { slug: "imap", label: "IMAP", adminOnly: true },
];

export function MailSubNav({
  domain,
  isAdmin,
}: {
  domain: string;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const enc = encodeURIComponent(domain);
  const base = `/domains/${enc}/mail`;
  const inWebmailUser =
    pathname.startsWith(`${base}/`) &&
    !TABS.some((t) => t.slug && pathname === `${base}/${t.slug}`);

  const tabs = TABS.filter((t) => !t.adminOnly || isAdmin);

  return (
    <nav className="flex flex-wrap gap-2 border-b border-panel-border pb-3">
      {tabs.map((t) => {
        const href = t.slug ? `${base}/${t.slug}` : base;
        const active =
          t.slug === ""
            ? pathname === base
            : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={t.slug || "overview"}
            href={href}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              active && !inWebmailUser
                ? "bg-panel-accent/20 text-white"
                : "text-panel-muted hover:bg-panel-card hover:text-white"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
      {inWebmailUser && (
        <span className="self-center px-2 text-xs text-panel-muted">
          Qmail
        </span>
      )}
    </nav>
  );
}
