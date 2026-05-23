"use client";

import { Button } from "@/components/ui";
import { useCallback, useEffect, useRef, useState } from "react";

export function FileCodeEditor({
  path,
  language,
  readOnly,
  content,
  onChange,
  onSave,
  onClose,
  saving,
}: {
  path: string;
  language: string;
  readOnly: boolean;
  content: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const [lineCount, setLineCount] = useState(1);

  const syncLines = useCallback((value: string) => {
    setLineCount(Math.max(1, value.split("\n").length));
  }, []);

  useEffect(() => {
    syncLines(content);
  }, [content, syncLines]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (!readOnly) onSave();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSave, readOnly]);

  function handleScroll() {
    const ta = textareaRef.current;
    const gutter = gutterRef.current;
    if (ta && gutter) gutter.scrollTop = ta.scrollTop;
  }

  function handleTab(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const ta = e.currentTarget;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = `${content.slice(0, start)}  ${content.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = start + 2;
    });
  }

  const lines = Array.from({ length: lineCount }, (_, i) => i + 1);

  return (
    <div className="overflow-hidden rounded-xl border border-panel-border bg-[#0d1117]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-panel-border px-4 py-2">
        <div className="min-w-0">
          <p className="truncate font-mono text-sm text-white">{path}</p>
          <p className="text-xs text-panel-muted">
            {language}
            {readOnly ? " · read-only" : " · Ctrl+S to save"}
          </p>
        </div>
        <div className="flex gap-2">
          {!readOnly && (
            <Button onClick={onSave} disabled={saving}>
              {saving ? "Save…" : "Save"}
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
      <div className="flex max-h-[min(70vh,560px)] overflow-hidden">
        <div
          ref={gutterRef}
          className="shrink-0 overflow-hidden border-r border-panel-border bg-[#161b22] px-3 py-3 text-right font-mono text-xs leading-6 text-slate-500 select-none"
          aria-hidden
        >
          {lines.map((n) => (
            <div key={n}>{n}</div>
          ))}
        </div>
        <textarea
          ref={textareaRef}
          readOnly={readOnly}
          spellCheck={false}
          className="min-h-[320px] w-full flex-1 resize-y bg-transparent px-4 py-3 font-mono text-sm leading-6 text-slate-100 caret-sky-400 focus:outline-none"
          value={content}
          onChange={(e) => {
            onChange(e.target.value);
            syncLines(e.target.value);
          }}
          onScroll={handleScroll}
          onKeyDown={handleTab}
        />
      </div>
    </div>
  );
}
