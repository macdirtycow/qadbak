import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { emit, resolveDomainUser } from "./provisioning-common.mjs";

const exec = promisify(execFile);

const LOG_CANDIDATES = [
  "/var/log/mail.log",
  "/var/log/maillog",
  "/var/log/mail/mail.log",
];

async function readTail(path, lines = 80) {
  try {
    const { stdout } = await exec("tail", ["-n", String(lines), path], {
      maxBuffer: 4 * 1024 * 1024,
    });
    return stdout.split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

export async function mailLogsSearch(domain, query) {
  await resolveDomainUser(domain);
  const q = String(query || "").trim();
  const pattern = q || domain;
  const lines = [];
  for (const logPath of LOG_CANDIDATES) {
    try {
      const { stdout } = await exec(
        "grep",
        ["-i", "-E", pattern, logPath],
        { maxBuffer: 2 * 1024 * 1024 },
      );
      lines.push(...stdout.split("\n").filter(Boolean).slice(-50));
    } catch {
      const tail = await readTail(logPath, 50);
      for (const line of tail) {
        if (line.toLowerCase().includes(domain.toLowerCase())) lines.push(line);
      }
    }
  }
  if (!lines.length) {
    for (const logPath of LOG_CANDIDATES) {
      try {
        await readFile(logPath, "utf8");
        lines.push(...(await readTail(logPath, 30)));
        if (lines.length) break;
      } catch {
        /* */
      }
    }
  }
  emit({ ok: true, lines: [...new Set(lines)].slice(-80), source: "native-mail-logs" });
}
