"use client";

import { Alert, Button, Card } from "@/components/ui";
import type { WebminModule } from "@/lib/webmin";
import { useMemo, useState } from "react";

function groupByCategory(modules: WebminModule[]): Map<string, WebminModule[]> {
  const map = new Map<string, WebminModule[]>();
  for (const m of modules) {
    const list = map.get(m.category) ?? [];
    list.push(m);
    map.set(m.category, list);
  }
  return map;
}

export function WebminHub({
  title,
  description,
  modules,
  linkApiPath,
  showRootBanner,
  webminBase,
  userminBase,
}: {
  title: string;
  description: string;
  modules: WebminModule[];
  linkApiPath: string;
  showRootBanner?: boolean;
  webminBase: string;
  userminBase: string;
}) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return modules;
    return modules.filter(
      (m) =>
        m.label.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q),
    );
  }, [modules, query]);

  const grouped = useMemo(() => groupByCategory(filtered), [filtered]);

  async function openModule(mod: WebminModule) {
    setLoading(mod.id);
    setError("");
    try {
      const res = await fetch(
        `${linkApiPath}?module=${encodeURIComponent(mod.id)}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create login link.");
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(null);
    }
  }

  async function openRootDashboard() {
    setLoading("_root");
    setError("");
    try {
      const res = await fetch(linkApiPath);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create login link.");
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">{title}</h1>
        <p className="mt-1 text-sm text-panel-muted">{description}</p>
      </div>

      {error && <Alert>{error}</Alert>}

      <Card>
        <p className="text-sm text-panel-muted">
          Webmin opens in a new tab via a one-time login link (
          <code className="text-white">create-login-link</code>). No password
          is stored in Nexmin.
        </p>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-panel-muted">Webmin URL</dt>
            <dd className="font-mono text-xs text-white break-all">{webminBase}</dd>
          </div>
          <div>
            <dt className="text-panel-muted">Usermin URL</dt>
            <dd className="font-mono text-xs text-white break-all">{userminBase}</dd>
          </div>
        </dl>
        {showRootBanner && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={openRootDashboard} disabled={loading !== null}>
              {loading === "_root" ? "Working…" : "Webmin dashboard (root)"}
            </Button>
          </div>
        )}
      </Card>

      <div>
        <input
          type="search"
          placeholder="Search module…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full max-w-md rounded-lg border border-panel-border bg-panel-bg px-3 py-2 text-sm text-white placeholder:text-panel-muted focus:border-panel-accent focus:outline-none"
        />
      </div>

      {[...grouped.entries()].map(([category, items]) => (
        <div key={category}>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-panel-muted">
            {category}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((mod) => (
              <Card
                key={mod.id}
                className="flex flex-col justify-between transition hover:border-panel-accent"
              >
                <div>
                  <h3 className="font-medium text-white">{mod.label}</h3>
                  <p className="mt-1 text-sm text-panel-muted">{mod.description}</p>
                  <p className="mt-2 font-mono text-xs text-slate-500">{mod.path}</p>
                </div>
                <Button
                  className="mt-4 w-full"
                  variant="secondary"
                  disabled={loading !== null}
                  onClick={() => openModule(mod)}
                >
                  {loading === mod.id ? "Working…" : "Open"}
                </Button>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {filtered.length === 0 && (
        <p className="text-sm text-panel-muted">No modules found.</p>
      )}
    </div>
  );
}
