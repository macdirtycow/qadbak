"use client";

type CatalogRow = {
  name: string;
  label?: string;
  desc?: string;
  version?: string;
  minPhp?: string;
  requiresDb?: boolean;
  icon?: string;
  category?: string;
};

export function DomainAppsPicker({
  available,
  selected,
  onSelect,
}: {
  available: CatalogRow[];
  selected: string;
  onSelect: (name: string) => void;
}) {
  if (available.length === 0) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {available.map((app) => {
        const active = selected === app.name;
        return (
          <button
            key={app.name}
            type="button"
            onClick={() => onSelect(app.name)}
            className={`rounded-lg border p-4 text-left transition ${
              active
                ? "border-panel-accent bg-panel-accent/10"
                : "border-panel-border hover:border-panel-accent/50"
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">{app.icon ?? "📦"}</span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-white">
                  {app.label ?? app.name}
                </p>
                <p className="mt-1 line-clamp-2 text-xs text-panel-muted">
                  {app.desc}
                </p>
                <p className="mt-2 text-xs text-panel-muted">
                  {app.version ? `v${app.version}` : ""}
                  {app.minPhp ? ` · PHP ${app.minPhp}+` : ""}
                  {app.requiresDb ? " · MySQL" : ""}
                </p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
