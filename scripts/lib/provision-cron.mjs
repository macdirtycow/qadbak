import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { emit, fail, resolveDomainUser } from "./provisioning-common.mjs";

const exec = promisify(execFile);

function parseCrontab(text) {
  const lines = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const parts = line.split(/\s+/);
    if (parts.length < 6) continue;
    const schedule = parts.slice(0, 5).join(" ");
    const command = parts.slice(5).join(" ");
    lines.push({ schedule, command, raw: line });
  }
  return lines;
}

export async function cronList(domain) {
  const { user } = await resolveDomainUser(domain);
  try {
    const { stdout } = await exec("crontab", ["-l", "-u", user], { maxBuffer: 1024 * 1024 });
    emit({ ok: true, jobs: parseCrontab(stdout) });
  } catch (e) {
    if (String(e).includes("no crontab")) {
      emit({ ok: true, jobs: [] });
      return;
    }
    fail(e instanceof Error ? e.message : String(e));
  }
}

export async function cronCreate(domain, schedule, command) {
  const { user } = await resolveDomainUser(domain);
  let existing = "";
  try {
    const { stdout } = await exec("crontab", ["-l", "-u", user]);
    existing = stdout;
  } catch {
    /* empty */
  }
  const line = `${schedule} ${command}\n`;
  const tmp = `/tmp/qadbak-cron-${user}-${Date.now()}`;
  const { writeFile } = await import("node:fs/promises");
  await writeFile(tmp, existing + line, "utf8");
  await exec("crontab", ["-u", user, tmp]);
  emit({ ok: true });
}

export async function cronDelete(domain, index) {
  const { user } = await resolveDomainUser(domain);
  let existing = "";
  try {
    const { stdout } = await exec("crontab", ["-l", "-u", user]);
    existing = stdout;
  } catch {
    emit({ ok: true });
    return;
  }
  const jobs = parseCrontab(existing);
  const idx = Number(index);
  if (idx < 0 || idx >= jobs.length) fail("Invalid cron job index");
  const keep = jobs.filter((_, i) => i !== idx);
  const { writeFile } = await import("node:fs/promises");
  const tmp = `/tmp/qadbak-cron-${user}-${Date.now()}`;
  const body = keep.map((j) => j.raw).join("\n") + (keep.length ? "\n" : "");
  await writeFile(tmp, body, "utf8");
  await exec("crontab", ["-u", user, tmp]);
  emit({ ok: true });
}
