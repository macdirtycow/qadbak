"use client";

import Link from "next/link";
import { Card } from "@/components/ui";
import {
  CATALOG_CATEGORY_LABELS,
  catalogByCategory,
  type WebminCatalogCategory,
} from "@/lib/webmin-catalog";

export function WebminModuleBrowser({
  category,
}: {
  category: WebminCatalogCategory;
}) {
  const modules = catalogByCategory(category);
  const title = CATALOG_CATEGORY_LABELS[category];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">{title}</h1>
        <p className="mt-1 text-sm text-panel-muted">
          In-panel Webmin modules — full native UI replaces these over time (see{" "}
          <code className="text-white">docs/PARITY-AUDIT.md</code>).
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((m) => (
          <Link key={m.id} href={`/admin/embed/${m.id}`}>
            <Card className="h-full transition hover:border-panel-accent">
              <p className="font-medium text-white">{m.label}</p>
              <p className="mt-1 text-xs text-panel-muted">{m.path}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
