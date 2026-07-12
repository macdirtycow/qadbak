"use client";

import { useCallback, useEffect, useState } from "react";
import type { JournalEntry, JournalStep } from "@/lib/journal/types";
import { Alert, Badge, Button, Card, Input, Label } from "@/components/ui";

interface ListResponse {
  entries: JournalEntry[];
  total: number;
  scannedDays: string[];
}

interface EntryResponse {
  entry: JournalEntry;
}

interface Filters {
  user: string;
  action: string;
  domain: string;
  days: string;
  failuresOnly: boolean;
}

const INITIAL_FILTERS: Filters = {
  user: "",
  action: "",
  domain: "",
  days: "7",
  failuresOnly: false,
};

function buildQuery(f: Filters): string {
  const p = new URLSearchParams();
  if (f.user) p.set("user", f.user);
  if (f.action) p.set("action", f.action);
  if (f.domain) p.set("domain", f.domain);
  if (f.days) p.set("days", f.days);
  if (f.failuresOnly) p.set("failuresOnly", "1");
  return p.toString();
}

export function JournalBrowser() {
  // `filters` is what the form fields currently show; `appliedFilters` is
  // what the listing actually reflects. Only "Apply filters" / Enter copies
  // one into the other - without this split, every keystroke would refetch
  // and in-flight requests for stale values could clobber the latest result,
  // which is exactly what made the button feel like it did nothing.
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<Filters>(INITIAL_FILTERS);
  const [list, setList] = useState<ListResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<JournalEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // Preselect an entry from ?focus=… so links from other pages can deep-link.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const focus = url.searchParams.get("focus");
    if (focus && /^[a-z0-9]+$/i.test(focus)) {
      setSelectedId(focus);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/journal?${buildQuery(appliedFilters)}`,
      );
      const data = (await res.json()) as ListResponse & { error?: string };
      if (!res.ok || data.error) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setList(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [appliedFilters]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    // Shallow clone so identical filter values still trigger a refetch  - 
    // makes "Apply filters" double as a manual reload.
    setAppliedFilters({ ...filters });
  }

  useEffect(() => {
    if (!selectedId) {
      setSelected(null);
      return;
    }
    setDetailLoading(true);
    setSelected(null);
    fetch(`/api/admin/journal/${encodeURIComponent(selectedId)}`)
      .then(async (r) => {
        const data = (await r.json()) as EntryResponse & { error?: string };
        if (!r.ok || data.error) throw new Error(data.error ?? `HTTP ${r.status}`);
        setSelected(data.entry);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => setDetailLoading(false));
  }, [selectedId]);

  return (
    <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
      <div className="space-y-4">
        <Card>
          <form onSubmit={applyFilters} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="j-user">User</Label>
                <Input
                  id="j-user"
                  value={filters.user}
                  placeholder="admin"
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, user: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="j-action">Action prefix</Label>
                <Input
                  id="j-action"
                  value={filters.action}
                  placeholder="domain. or mail."
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, action: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="j-domain">Domain</Label>
                <Input
                  id="j-domain"
                  value={filters.domain}
                  placeholder="example.com"
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, domain: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label htmlFor="j-days">Days back</Label>
                <Input
                  id="j-days"
                  type="number"
                  min={1}
                  max={30}
                  value={filters.days}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, days: e.target.value }))
                  }
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-panel-muted">
              <input
                type="checkbox"
                checked={filters.failuresOnly}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, failuresOnly: e.target.checked }))
                }
              />
              Failures only
            </label>
            <Button type="submit" disabled={loading}>
              {loading ? "Loading…" : "Apply filters"}
            </Button>
          </form>
        </Card>

        {error ? <Alert variant="error">{error}</Alert> : null}

        <Card className="p-0">
          <div className="border-b border-panel-border px-4 py-2 text-xs uppercase tracking-wide text-panel-muted">
            {list ? `${list.entries.length} of ${list.total} entries` : " - "}
          </div>
          <ul className="max-h-[60vh] divide-y divide-panel-border overflow-y-auto">
            {(list?.entries ?? []).map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(e.id)}
                  className={`flex w-full flex-col gap-1 px-4 py-3 text-left text-sm transition hover:bg-panel-card/80 ${
                    selectedId === e.id ? "bg-panel-accent/15" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-white">{e.summary}</span>
                    {e.ok ? (
                      <Badge tone="success">OK</Badge>
                    ) : (
                      <Badge tone="danger">FAIL</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 text-xs text-panel-muted">
                    <span>{e.action}</span>
                    <span>·</span>
                    <span>{e.username}</span>
                    <span>·</span>
                    <span>{relativeTime(e.startedAt)}</span>
                    <span>·</span>
                    <span>{e.durationMs} ms</span>
                    {e.target?.domain ? (
                      <>
                        <span>·</span>
                        <span>{e.target.domain}</span>
                      </>
                    ) : null}
                  </div>
                </button>
              </li>
            ))}
            {list && list.entries.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-panel-muted">
                No entries yet. As soon as someone creates a domain (or other
                hooked action), it&apos;ll appear here.
              </li>
            ) : null}
          </ul>
        </Card>
      </div>

      <div>
        {detailLoading ? (
          <Card>
            <p className="text-sm text-panel-muted">Loading entry…</p>
          </Card>
        ) : selected ? (
          <JournalEntryDetail
            entry={selected}
            onUndone={async (updated) => {
              setSelected(updated);
              await refresh();
            }}
          />
        ) : (
          <Card className="border-dashed border-panel-border/80 bg-panel-card/30">
            <p className="text-sm text-panel-muted">
              Pick an entry on the left to see exactly what Linux did during
              that action.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

function JournalEntryDetail({
  entry,
  onUndone,
}: {
  entry: JournalEntry;
  onUndone: (updated: JournalEntry) => void | Promise<void>;
}) {
  const stepCount = entry.steps.length;
  const failures = entry.steps.filter((s) => !s.ok).length;
  const [undoing, setUndoing] = useState(false);
  const [undoConfirm, setUndoConfirm] = useState(false);
  const [undoMsg, setUndoMsg] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  const canUndo =
    entry.undoable &&
    !entry.undoneAt &&
    !!entry.undoSpec &&
    withinTtl(entry);

  async function runUndo() {
    setUndoing(true);
    setUndoMsg(null);
    try {
      const res = await fetch(
        `/api/admin/journal/${encodeURIComponent(entry.id)}/undo`,
        { method: "POST" },
      );
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        summary?: string;
        originalEntry?: JournalEntry;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setUndoMsg({ tone: "success", text: data.summary ?? "Undone." });
      setUndoConfirm(false);
      if (data.originalEntry) {
        await onUndone(data.originalEntry);
      }
    } catch (e) {
      setUndoMsg({
        tone: "error",
        text: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setUndoing(false);
    }
  }

  return (
    <Card className="space-y-5">
      <header className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">{entry.summary}</h2>
          <div className="flex items-center gap-2">
            {entry.undoneAt ? (
              <Badge tone="warning">Undone</Badge>
            ) : entry.ok ? (
              <Badge tone="success">Succeeded</Badge>
            ) : (
              <Badge tone="danger">Failed</Badge>
            )}
            {canUndo && !undoConfirm ? (
              <Button
                variant="secondary"
                onClick={() => setUndoConfirm(true)}
                disabled={undoing}
              >
                Undo
              </Button>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-x-3 text-xs text-panel-muted">
          <span>action: {entry.action}</span>
          <span>·</span>
          <span>user: {entry.username} ({entry.role})</span>
          <span>·</span>
          <span>{new Date(entry.startedAt).toLocaleString()}</span>
          <span>·</span>
          <span>{entry.durationMs} ms total</span>
          <span>·</span>
          <span>
            {stepCount} step{stepCount === 1 ? "" : "s"}
            {failures ? `, ${failures} failed` : ""}
          </span>
        </div>
        {entry.target ? (
          <div className="text-xs text-panel-muted">
            {Object.entries(entry.target)
              .filter(([, v]) => Boolean(v))
              .map(([k, v]) => `${k}=${v}`)
              .join(" · ")}
          </div>
        ) : null}
      </header>

      {entry.errorMessage ? (
        <Alert variant="error">{entry.errorMessage}</Alert>
      ) : null}

      {entry.undoneAt ? (
        <Alert variant="info">
          Undone by <strong>{entry.undoneBy ?? "?"}</strong> on{" "}
          {new Date(entry.undoneAt).toLocaleString()}
          {entry.undoneByEntryId ? (
            <>
              {" "}·{" "}
              <button
                type="button"
                className="underline hover:text-white"
                onClick={() => {
                  const url = new URL(window.location.href);
                  url.searchParams.set("focus", entry.undoneByEntryId!);
                  window.location.assign(url.toString());
                }}
              >
                view undo entry
              </button>
            </>
          ) : null}
        </Alert>
      ) : null}

      {undoConfirm && canUndo ? (
        <Alert variant="info">
          <p className="text-sm">
            <strong className="text-white">Reverse this action?</strong>
            {entry.undoSpec?.warning ? (
              <>
                <br />
                {entry.undoSpec.warning}
              </>
            ) : null}
            {entry.undoSpec?.ttlMinutes ? (
              <>
                <br />
                <span className="text-xs text-panel-muted">
                  Undo window: {entry.undoSpec.ttlMinutes} min from action time.
                </span>
              </>
            ) : null}
          </p>
          <div className="mt-3 flex gap-2">
            <Button variant="danger" onClick={runUndo} disabled={undoing}>
              {undoing ? "Undoing…" : "Yes, undo it"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setUndoConfirm(false)}
              disabled={undoing}
            >
              Cancel
            </Button>
          </div>
        </Alert>
      ) : null}

      {undoMsg ? (
        <Alert variant={undoMsg.tone === "success" ? "success" : "error"}>
          {undoMsg.text}
        </Alert>
      ) : null}

      <ol className="space-y-3 border-l border-panel-border pl-4">
        {entry.steps.map((s, i) => (
          <StepItem key={`${entry.id}-${i}`} step={s} index={i} />
        ))}
        {entry.steps.length === 0 ? (
          <li className="text-sm text-panel-muted">
            (No low-level steps recorded - this action only has a summary entry.)
          </li>
        ) : null}
      </ol>

      {entry.metadata && Object.keys(entry.metadata).length > 0 ? (
        <details className="text-xs">
          <summary className="cursor-pointer text-panel-muted hover:text-white">
            Metadata
          </summary>
          <pre className="mt-2 overflow-x-auto rounded bg-black/40 p-3 text-xs text-slate-300">
            {JSON.stringify(entry.metadata, null, 2)}
          </pre>
        </details>
      ) : null}
    </Card>
  );
}

function StepItem({ step, index }: { step: JournalStep; index: number }) {
  return (
    <li className="space-y-1">
      <div className="flex items-start gap-2">
        <KindBadge kind={step.kind} ok={step.ok} />
        <span className="font-medium text-white">{step.summary}</span>
        {step.durationMs > 0 ? (
          <span className="text-xs text-panel-muted">· {step.durationMs} ms</span>
        ) : null}
      </div>
      {step.errorMessage ? (
        <div className="ml-7 text-xs text-red-300">{step.errorMessage}</div>
      ) : null}
      {step.command ? (
        <pre className="ml-7 overflow-x-auto rounded bg-black/40 p-2 text-xs text-emerald-200">
          <span className="text-panel-muted">$ </span>
          {step.command}
        </pre>
      ) : null}
      {step.filePath ? (
        <div className="ml-7 text-xs text-panel-muted">
          → {step.filePath}
          {step.byteSize != null ? ` (${step.byteSize} B)` : ""}
        </div>
      ) : null}
      {step.diffPreview ? (
        <details className="ml-7">
          <summary className="cursor-pointer text-xs text-panel-muted hover:text-white">
            diff (#{index + 1})
          </summary>
          <pre className="mt-1 overflow-x-auto rounded bg-black/40 p-2 text-xs text-slate-300">
            {step.diffPreview}
          </pre>
        </details>
      ) : null}
      {step.output ? (
        <details className="ml-7">
          <summary className="cursor-pointer text-xs text-panel-muted hover:text-white">
            output
          </summary>
          <pre className="mt-1 overflow-x-auto rounded bg-black/40 p-2 text-xs text-slate-300">
            {step.output}
          </pre>
        </details>
      ) : null}
      {step.externalUrl ? (
        <div className="ml-7 text-xs text-panel-muted">→ {step.externalUrl}</div>
      ) : null}
    </li>
  );
}

function KindBadge({
  kind,
  ok,
}: {
  kind: JournalStep["kind"];
  ok: boolean;
}) {
  const palette: Record<JournalStep["kind"], string> = {
    shell: "bg-emerald-900/50 text-emerald-300",
    "file-write": "bg-sky-900/50 text-sky-300",
    "file-delete": "bg-amber-900/50 text-amber-300",
    "service-reload": "bg-violet-900/50 text-violet-300",
    "external-http": "bg-indigo-900/50 text-indigo-300",
    "external-script": "bg-slate-700 text-slate-200",
    info: "bg-slate-700 text-slate-300",
    error: "bg-red-900/60 text-red-300",
  };
  return (
    <span
      className={`inline-flex w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold ${
        ok ? palette[kind] : palette.error
      }`}
      title={kind}
    >
      {kindGlyph(kind)}
    </span>
  );
}

function kindGlyph(kind: JournalStep["kind"]): string {
  switch (kind) {
    case "shell":
      return ">";
    case "file-write":
      return "F";
    case "file-delete":
      return "D";
    case "service-reload":
      return "R";
    case "external-http":
      return "H";
    case "external-script":
      return "S";
    case "info":
      return "i";
    case "error":
      return "!";
  }
}

function withinTtl(entry: JournalEntry): boolean {
  const ttl = entry.undoSpec?.ttlMinutes;
  if (!ttl) return true;
  const ageMs = Date.now() - new Date(entry.startedAt).getTime();
  return ageMs <= ttl * 60_000;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const s = Math.round(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}
