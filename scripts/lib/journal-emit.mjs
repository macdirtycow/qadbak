/**
 * Tiny helper used by native provisioning scripts to emit structured
 * journal-step events on stdout.
 *
 * The TS layer (src/lib/journal/helper-stream.ts) picks these up while still
 * letting the final `{ok:..., ...}` line through unchanged.
 *
 * Example:
 *
 *   import { jstep, jshell, jwrite, jreload } from "./journal-emit.mjs";
 *
 *   jstep("info", "Validating domain name");
 *   await jshell("nginx -t", { sudo: true });
 *   await jwrite("/etc/nginx/sites-available/foo.conf", contents);
 *   jreload("nginx");
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, readFile, stat } from "node:fs/promises";
import { performance } from "node:perf_hooks";

const execAsync = promisify(execFile);

const MAX_OUTPUT_BYTES = 4096;
const MAX_DIFF_LINES = 40;

function emitStep(step) {
  try {
    process.stdout.write(
      `${JSON.stringify({ event: "journal-step", ...step })}\n`,
    );
  } catch {
    // best-effort
  }
}

function sanitize(value) {
  if (typeof value !== "string") return value;
  return value
    .replace(
      /\b([A-Z][A-Z0-9_]*(?:PASS(?:WORD)?|SECRET|TOKEN|KEY|JWT|CREDENTIALS)[A-Z0-9_]*)=(?:"[^"]*"|'[^']*'|\S+)/g,
      "$1=***",
    )
    .replace(
      /(--?(?:password|pass|secret|token|key|api[-_]?key|jwt)(?:=|\s+))(?:"[^"]*"|'[^']*'|\S+)/gi,
      "$1***",
    )
    .replace(/\bQAD-[A-Za-z0-9]{4,}(?:-[A-Za-z0-9]{4,}){1,}/g, "QAD-***");
}

function truncate(value, max = MAX_OUTPUT_BYTES) {
  const s = String(value);
  return s.length <= max ? s : `${s.slice(0, max)}\n…[${s.length - max} bytes truncated]`;
}

/** Emit a generic journal step. */
export function jstep(kind, summary, extra = {}) {
  emitStep({
    kind,
    summary,
    ok: extra.ok !== false,
    durationMs: Math.max(0, Math.round(extra.durationMs ?? 0)),
    startedAt: new Date().toISOString(),
    ...(extra.command ? { command: sanitize(extra.command) } : {}),
    ...(extra.filePath ? { filePath: extra.filePath } : {}),
    ...(extra.diffPreview
      ? { diffPreview: truncate(extra.diffPreview) }
      : {}),
    ...(typeof extra.byteSize === "number" ? { byteSize: extra.byteSize } : {}),
    ...(extra.output ? { output: truncate(sanitize(extra.output)) } : {}),
    ...(extra.externalUrl ? { externalUrl: extra.externalUrl } : {}),
    ...(extra.errorMessage
      ? { errorMessage: sanitize(extra.errorMessage) }
      : {}),
  });
}

/** Run a shell command and emit a journal step capturing it. */
export async function jshell(command, args = [], opts = {}) {
  const cmdStr = `${command} ${args.join(" ")}`.trim();
  const t0 = performance.now();
  try {
    const result = await execAsync(command, args, {
      timeout: opts.timeout ?? 120_000,
      maxBuffer: opts.maxBuffer ?? 8 * 1024 * 1024,
    });
    jstep("shell", opts.summary ?? shortCmd(cmdStr), {
      command: cmdStr,
      output: result.stdout || result.stderr,
      durationMs: performance.now() - t0,
    });
    return result;
  } catch (e) {
    jstep("shell", opts.summary ?? shortCmd(cmdStr), {
      command: cmdStr,
      output: e?.stdout || e?.stderr || e?.message,
      durationMs: performance.now() - t0,
      ok: false,
      errorMessage: e?.message,
    });
    throw e;
  }
}

/** Write a file and emit a journal step with a tiny diff preview. */
export async function jwrite(filePath, contents, opts = {}) {
  const t0 = performance.now();
  let oldContents = "";
  try {
    oldContents = await readFile(filePath, "utf8");
  } catch {
    /* file didn't exist */
  }
  await writeFile(filePath, contents, opts.mode ?? undefined);
  const s = await stat(filePath).catch(() => null);
  const diff = makeDiff(oldContents, String(contents));
  jstep("file-write", opts.summary ?? `Wrote ${filePath}`, {
    filePath,
    byteSize: s?.size,
    diffPreview: diff || undefined,
    durationMs: performance.now() - t0,
  });
}

/** Emit a service-reload step (callers usually still need to actually trigger the reload separately). */
export function jreload(service, opts = {}) {
  jstep("service-reload", opts.summary ?? `Reloaded ${service}`, {
    ok: opts.ok !== false,
    durationMs: opts.durationMs ?? 0,
  });
}

/** Convenience for an info breadcrumb. */
export function jinfo(summary) {
  jstep("info", summary);
}

function shortCmd(cmd) {
  return cmd.length <= 80 ? cmd : `${cmd.slice(0, 77)}…`;
}

/**
 * Tiny "context diff": emit only the first MAX_DIFF_LINES changed lines.
 * Not a real unified diff — keep it minimal to avoid a dep on `diff`.
 */
function makeDiff(oldStr, newStr) {
  if (!oldStr && !newStr) return "";
  if (!oldStr) return `(new file, ${newStr.split("\n").length} lines)`;
  if (oldStr === newStr) return "(no change)";
  const oldLines = oldStr.split("\n");
  const newLines = newStr.split("\n");
  const out = [];
  const max = Math.min(
    Math.max(oldLines.length, newLines.length),
    MAX_DIFF_LINES * 4,
  );
  for (let i = 0; i < max && out.length < MAX_DIFF_LINES; i += 1) {
    const a = oldLines[i] ?? "";
    const b = newLines[i] ?? "";
    if (a === b) continue;
    if (a) out.push(`- ${a}`);
    if (b) out.push(`+ ${b}`);
  }
  if (!out.length) return "(no change visible in first 160 lines)";
  return out.join("\n");
}
