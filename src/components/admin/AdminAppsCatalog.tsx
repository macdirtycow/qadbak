"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui";
import { CATEGORY_LABELS } from "@/lib/apps/catalog-labels";
import type { AppCatalogEntry, AppCategory } from "@/lib/apps/catalog-types";
import type { AppTemplateSummary } from "@/lib/apps/types";

const CATEGORY_ORDER: AppCategory[] = [
  "cms",
  "collaboration",
  "analytics",
  "tools",
  "ecommerce",
];

export function AdminAppsCatalog({
  templates,
  catalog,
}: {
  templates: AppTemplateSummary[];
  catalog: AppCatalogEntry[];
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<AppCategory | "all">("all");

  const intentIds = new Set(templates.map((t) => t.id));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog.filter((app) => {
      if (category !== "all" && app.category !== category) return false;
      if (!q) return true;
      return (
        app.label.toLowerCase().includes(q) ||
        app.desc.toLowerCase().includes(q) ||
        app.tagline.toLowerCase().includes(q)
      );
    });
  }, [catalog, query, category]);

  const featured = filtered.filter((a) => a.featured && !a.comingSoon);
  const restByCategory = CATEGORY_ORDER.map((cat) => ({
    cat,
    items: filtered.filter(
      (a) => a.category === cat && !a.featured && !a.comingSoon,
    ),
  })).filter((g) => g.items.length > 0);
  const coming = filtered.filter((a) => a.comingSoon);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Search apps…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="min-w-[200px] flex-1 rounded-lg border border-panel-border bg-panel-bg px-3 py-2 text-sm text-white"
        />
        <select
          value={category}
          onChange={(e) =>
            setCategory(e.target.value as AppCategory | "all")
          }
          className="rounded-lg border border-panel-border bg-panel-bg px-3 py-2 text-sm text-white"
        >
          <option value="all">All categories</option>
          {CATEGORY_ORDER.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </div>

      {featured.length > 0 && (
        <section>
          <h2 className="text-sm font-medium uppercase tracking-wide text-panel-muted">
            Featured
          </h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((app) => (
              <AppCard key={app.id} app={app} hasIntent={intentIds.has(app.id)} />
            ))}
          </div>
        </section>
      )}

      {restByCategory.map(({ cat, items }) => (
        <section key={cat}>
          <h2 className="text-sm font-medium uppercase tracking-wide text-panel-muted">
            {CATEGORY_LABELS[cat]}
          </h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((app) => (
              <AppCard key={app.id} app={app} hasIntent={intentIds.has(app.id)} />
            ))}
          </div>
        </section>
      ))}

      {coming.length > 0 && (
        <section>
          <h2 className="text-sm font-medium uppercase tracking-wide text-panel-muted">
            Coming soon
          </h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {coming.map((app) => (
              <AppCard key={app.id} app={app} hasIntent={false} />
            ))}
          </div>
        </section>
      )}

      <p className="text-sm text-panel-muted">
        Per-domain installs (custom path, rollback) live under{" "}
        <strong className="text-white">Domains → [domain] → Apps</strong>.
      </p>
    </div>
  );
}

function AppCard({
  app,
  hasIntent,
}: {
  app: AppCatalogEntry;
  hasIntent: boolean;
}) {
  const badges = [
    app.version && `v${app.version}`,
    app.minPhp && `PHP ${app.minPhp}+`,
    app.requiresDb ? "MySQL" : null,
  ].filter(Boolean);

  const inner = (
    <Card
      className={`h-full transition ${
        app.comingSoon
          ? "opacity-60"
          : "hover:border-panel-accent"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-3xl">{app.icon}</span>
        {app.comingSoon ? (
          <span className="rounded bg-panel-border px-2 py-0.5 text-xs text-panel-muted">
            Soon
          </span>
        ) : hasIntent ? (
          <span className="rounded bg-panel-accent/20 px-2 py-0.5 text-xs text-panel-accent">
            One-click
          </span>
        ) : null}
      </div>
      <h3 className="mt-3 text-lg font-medium text-white">{app.label}</h3>
      <p className="mt-1 text-sm text-panel-muted">{app.tagline}</p>
      <div className="mt-3 flex flex-wrap gap-1">
        {badges.map((b) => (
          <span
            key={b}
            className="rounded bg-black/30 px-1.5 py-0.5 text-xs text-panel-muted"
          >
            {b}
          </span>
        ))}
      </div>
      {app.etaSeconds && hasIntent ? (
        <p className="mt-3 text-xs uppercase tracking-wide text-panel-muted/70">
          ~{Math.ceil(app.etaSeconds / 60)} min · DB + files + journal
        </p>
      ) : null}
    </Card>
  );

  if (app.comingSoon || !hasIntent) {
    return <div>{inner}</div>;
  }

  return (
    <Link href={`/admin/apps/${encodeURIComponent(app.id)}/install`}>
      {inner}
    </Link>
  );
}
