"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { PageHeader, Input, Card } from "@/components/ui";
import { PremiumNavLock } from "@/lib/premium/stubs";
import {
  filterSettings,
  settingsCategories,
  settingsForRole,
  type SettingsEntry,
} from "@/lib/settings-registry";
import { Search } from "lucide-react";

export function SettingsHub({
  role,
  unlockedPremium = [],
}: {
  role: "admin" | "client";
  unlockedPremium?: string[];
}) {
  const [query, setQuery] = useState("");
  const unlocked = useMemo(() => new Set(unlockedPremium), [unlockedPremium]);
  const entries = useMemo(() => settingsForRole(role), [role]);
  const filtered = useMemo(
    () => (query.trim() ? filterSettings(entries, query) : entries),
    [entries, query],
  );
  const categories = useMemo(
    () => settingsCategories(filtered),
    [filtered],
  );

  return (
    <div>
      <Breadcrumbs items={[{ label: "Settings" }]} />
      <PageHeader
        title="Settings"
        description="Find panel, account, server, and billing settings in one place. Use search or browse by category."
      />
      <div className="relative mb-6 max-w-md">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-panel-muted" />
        <Input
          type="search"
          placeholder="Search settings…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
          aria-label="Search settings"
        />
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-panel-muted">No settings match your search.</p>
      ) : (
        <div className="space-y-8">
          {categories.map((cat) => (
            <section key={cat}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-panel-muted">
                {cat}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filtered
                  .filter((e) => e.category === cat)
                  .map((entry) => (
                    <SettingsCard
                      key={entry.id}
                      entry={entry}
                      locked={!!entry.premium && !unlocked.has(entry.premium)}
                    />
                  ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsCard({
  entry,
  locked,
}: {
  entry: SettingsEntry;
  locked: boolean;
}) {
  return (
    <Link href={entry.href}>
      <Card className="h-full transition hover:border-panel-accent/40 hover:shadow-panel">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium text-panel-text">{entry.title}</h3>
          {locked ? <PremiumNavLock /> : null}
        </div>
        <p className="mt-2 text-sm leading-relaxed text-panel-muted">
          {entry.description}
        </p>
      </Card>
    </Link>
  );
}
