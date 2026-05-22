import { parseCronJobs } from "./virtualmin-api-parse";
import type { CronJob } from "./virtualmin";
import type { Role } from "./types";
import { runDomainFsSudo } from "./domain-fs-sudo";

async function runHelper(cmd: string, target: string): Promise<string[]> {
  const stdout = await runDomainFsSudo([cmd, target], {
    timeout: 15_000,
    maxBuffer: 1024 * 1024,
  });
  const line = stdout.trim().split("\n").pop() ?? "";
  const parsed = JSON.parse(line) as { ok?: boolean; lines?: string[]; error?: string };
  if (!parsed.ok) {
    throw new Error(parsed.error ?? "Crontab read failed.");
  }
  return parsed.lines ?? [];
}

async function resolveUnixUser(
  domain: string,
  actor: { role: Role; domains: string[] },
): Promise<string> {
  const { listDomains } = await import("./virtualmin");
  const rows = await listDomains(actor);
  const row = rows.find((d) => d.name.toLowerCase() === domain.toLowerCase());
  if (row?.user) return row.user;
  return domain.split(".")[0].toLowerCase().replace(/[^a-z0-9_-]/g, "") || "site";
}

export async function listCronJobsLive(
  domain: string,
  actor: { role: Role; domains: string[] },
): Promise<CronJob[]> {
  const user = await resolveUnixUser(domain, actor);
  const lines = await runHelper("crontab-list", user);
  return parseCronJobs({ lines });
}
