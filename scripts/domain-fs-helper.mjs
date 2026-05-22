#!/usr/bin/env node
/**
 * Root-only filesystem helper for Qadbak live file manager.
 * Invoked as: sudo node domain-fs-helper.mjs <cmd> <absolute-path> [payload-json]
 * Paths must stay under /home/.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";

const execFileAsync = promisify(execFile);

const MAX_READ_BYTES = 5 * 1024 * 1024;
const MAX_WRITE_BYTES = 10 * 1024 * 1024;

/** Keep in sync with TEXT_EXTENSIONS in src/lib/domain-files.ts */
const TEXT_EXTENSIONS = new Set([
  "html",
  "htm",
  "css",
  "js",
  "mjs",
  "json",
  "txt",
  "md",
  "xml",
  "svg",
  "php",
  "cgi",
  "sh",
  "py",
  "yml",
  "yaml",
  "env",
  "htaccess",
  "conf",
  "ini",
  "log",
]);

function fileExtension(name) {
  if (name === ".htaccess" || name.startsWith(".env")) return "htaccess";
  if (name.startsWith(".")) {
    const parts = name.slice(1).split(".");
    return parts.length > 1 ? parts.pop().toLowerCase() : name.slice(1).toLowerCase();
  }
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : "";
}

function isTextByPath(filePath) {
  const base = path.basename(filePath);
  if (base === ".htaccess" || base.startsWith(".env")) return true;
  const ext = fileExtension(base);
  return ext !== "" && TEXT_EXTENSIONS.has(ext);
}

function fail(message, code = 1) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function emit(obj) {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
}

async function assertHomePath(target) {
  if (!target || typeof target !== "string") fail("Path required.");
  const resolved = await fs.realpath(target).catch(() => null);
  if (!resolved || (resolved !== "/home" && !resolved.startsWith("/home/"))) {
    fail("Path must be under /home/.");
  }
  return resolved;
}

function homeUnixUser(resolvedPath) {
  const m = String(resolvedPath).match(/^\/home\/([^/]+)\//);
  return m ? m[1] : null;
}

async function chownToHomeUser(targetPath) {
  const resolved = await fs.realpath(targetPath).catch(() => targetPath);
  const user = homeUnixUser(resolved);
  if (!user) return;
  try {
    await execFileAsync("chown", [`${user}:${user}`, resolved]);
  } catch {
    /* non-fatal */
  }
}

async function listDir(absPath) {
  const resolved = await assertHomePath(absPath);
  const names = await fs.readdir(resolved);
  const entries = [];
  for (const name of names) {
    if (name === "." || name === "..") continue;
    const full = path.join(resolved, name);
    let st;
    try {
      st = await fs.lstat(full);
    } catch {
      continue;
    }
    entries.push({
      name,
      type: st.isDirectory() ? "dir" : "file",
      sizeBytes: st.isFile() ? st.size : undefined,
      modified: st.mtime.toISOString().slice(0, 10),
    });
  }
  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  emit({ ok: true, entries });
}

async function readFile(absPath) {
  const resolved = await assertHomePath(absPath);
  const st = await fs.stat(resolved);
  if (!st.isFile()) fail("Not a file.");
  if (st.size > MAX_READ_BYTES) fail("File too large to read in panel.");
  const buf = await fs.readFile(resolved);
  if (isTextByPath(resolved)) {
    emit({
      ok: true,
      sizeBytes: st.size,
      encoding: "text",
      content: buf.toString("latin1"),
    });
    return;
  }
  const hasNull = buf.includes(0);
  const isText = !hasNull;
  emit({
    ok: true,
    sizeBytes: st.size,
    encoding: isText ? "text" : "base64",
    content: isText ? buf.toString("utf8") : buf.toString("base64"),
  });
}

async function writeFile(absPath, content) {
  const parent = path.dirname(absPath);
  await assertHomePath(parent);
  const encoding = isTextByPath(absPath) ? "latin1" : "utf8";
  const bytes = Buffer.from(content, encoding);
  if (bytes.length > MAX_WRITE_BYTES) fail("File too large.");
  await fs.writeFile(absPath, bytes, { flag: "w" });
  await chownToHomeUser(absPath);
  emit({ ok: true });
}

async function mkdirPath(absPath) {
  await assertHomePath(path.dirname(absPath));
  await fs.mkdir(absPath, { recursive: false });
  await chownToHomeUser(absPath);
  emit({ ok: true });
}

async function removePath(absPath) {
  const resolved = await assertHomePath(absPath);
  const st = await fs.lstat(resolved);
  if (st.isDirectory()) {
    await fs.rmdir(resolved);
  } else {
    await fs.unlink(resolved);
  }
  emit({ ok: true });
}

async function main() {
  const [cmd, target, payloadRaw] = process.argv.slice(2);
  if (!cmd || !target) fail("Usage: domain-fs-helper.mjs <cmd> <path> [json]");

  switch (cmd) {
    case "list":
      await listDir(target);
      break;
    case "read":
      await readFile(target);
      break;
    case "write": {
      const payload = payloadRaw ? JSON.parse(payloadRaw) : {};
      if (payload.content === undefined) fail("content required");
      await writeFile(target, String(payload.content));
      break;
    }
    case "mkdir":
      await mkdirPath(target);
      break;
    case "unlink":
      await removePath(target);
      break;
    case "crontab-list": {
      const user = target;
      if (!/^[a-z0-9_-]+$/.test(user)) fail("Invalid unix user.");
      try {
        const { stdout } = await execFileAsync("crontab", ["-l", "-u", user], {
          encoding: "utf8",
          maxBuffer: 1024 * 1024,
        });
        const lines = stdout
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter((l) => l && !l.startsWith("#"));
        emit({ ok: true, lines });
      } catch (e) {
        if (String(e).includes("no crontab")) {
          emit({ ok: true, lines: [] });
        } else {
          fail(e instanceof Error ? e.message : String(e));
        }
      }
      break;
    }
    case "write-bytes": {
      const payload = payloadRaw ? JSON.parse(payloadRaw) : {};
      if (!payload.base64) fail("base64 required");
      const parent = path.dirname(target);
      await assertHomePath(parent);
      const buf = Buffer.from(String(payload.base64), "base64");
      if (buf.length > MAX_WRITE_BYTES) fail("File too large.");
      await fs.writeFile(target, buf);
      await chownToHomeUser(target);
      emit({ ok: true, sizeBytes: buf.length });
      break;
    }
    default:
      fail(`Unknown command: ${cmd}`);
  }
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
