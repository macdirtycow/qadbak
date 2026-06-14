"use client";

type Point = { label: string; value: number };

export function MiniBarChart({
  points,
  maxBars = 12,
  className = "",
}: {
  points: Point[];
  maxBars?: number;
  className?: string;
}) {
  const slice = points.slice(-maxBars);
  const max = Math.max(1, ...slice.map((p) => p.value));

  if (!slice.length) {
    return <p className="text-xs text-panel-muted">No data yet.</p>;
  }

  return (
    <div className={`flex items-end gap-1 ${className}`} style={{ minHeight: 64 }}>
      {slice.map((p) => (
        <div key={p.label} className="flex flex-1 flex-col items-center gap-1">
          <div
            className="w-full rounded-t bg-panel-accent/70"
            style={{ height: `${Math.max(4, (p.value / max) * 56)}px` }}
            title={`${p.label}: ${p.value}`}
          />
          <span className="max-w-full truncate text-[10px] text-panel-muted">{p.label}</span>
        </div>
      ))}
    </div>
  );
}
