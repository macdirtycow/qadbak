import type { CronJob, DnsRecord } from "./virtualmin";

function vmField(row: Record<string, unknown>, key: string): string | undefined {
  const dotted = row[`values.${key}`];
  if (dotted !== undefined && dotted !== null) return String(dotted);
  const direct = row[key];
  if (direct !== undefined && direct !== null) return String(direct);
  return undefined;
}

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (v !== undefined && v !== null) return [String(v)];
  return [];
}

/** Unwrap run-api-command / nested VirtualMin JSON envelopes. */
export function unwrapVirtualminPayload(data: unknown): unknown {
  if (!data || typeof data !== "object") return data;
  const obj = data as Record<string, unknown>;
  if (obj.data !== undefined) return unwrapVirtualminPayload(obj.data);
  if (typeof obj.output === "string" && obj.output.trim()) {
    try {
      return JSON.parse(obj.output.trim());
    } catch {
      return { lines: obj.output.split(/\r?\n/), raw: obj.output };
    }
  }
  return data;
}

export function normalizeApiRows(data: unknown): Record<string, unknown>[] {
  const payload = unwrapVirtualminPayload(data);
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as Record<string, unknown>[];
    if (Array.isArray(obj.records)) return obj.records as Record<string, unknown>[];
    if (typeof obj.lines === "object" && Array.isArray(obj.lines)) {
      return (obj.lines as string[]).map((line) => ({ line }));
    }
    if (typeof obj.raw === "string") {
      return obj.raw.split(/\r?\n/).map((line) => ({ line }));
    }
  }
  return [];
}

/** Parse get-dns --multiline JSON (see virtualmin json-lib.pl). */
export function parseDnsRecords(data: unknown): DnsRecord[] {
  const rows = normalizeApiRows(data);
  const records: DnsRecord[] = [];

  for (const row of rows) {
    const name = vmField(row, "name") ?? "@";
    const values = row.values;
    if (values && typeof values === "object" && !Array.isArray(values)) {
      const v = values as Record<string, unknown>;
      const types = asStringArray(v.type ?? v.Type);
      const addrs = asStringArray(
        v.address ?? v.addr ?? v.value ?? v.Value ?? v.target,
      );
      const ttls = asStringArray(v.ttl ?? v.TTL);
      const prios = asStringArray(v.priority ?? v.prio ?? v.Priority);
      const count = Math.max(types.length, addrs.length, 1);
      for (let i = 0; i < count; i++) {
        const type = types[i] ?? types[0];
        const value = addrs[i] ?? addrs[0];
        if (!type || !value) continue;
        records.push({
          name: name || "@",
          type: type.toUpperCase(),
          value,
          ttl: ttls[i] ?? ttls[0],
          priority: prios[i] ?? prios[0],
        });
      }
      continue;
    }

    const combined = String(row.line ?? row.name ?? "").trim();
    if (!combined) continue;

    const parsed = parseDnsLine(combined);
    if (parsed) records.push(parsed);
  }

  return dedupeDnsRecords(records);
}

function parseDnsLine(line: string): DnsRecord | null {
  if (
    line.startsWith("Running ") ||
    line.startsWith("..") ||
    line.startsWith("virtualmin ")
  ) {
    return null;
  }
  const parts = line.split(/\s+/);
  if (parts.length >= 4 && /^\d+$/.test(parts[2])) {
    return {
      name: parts[0] === "" ? "@" : parts[0],
      type: parts[1].toUpperCase(),
      ttl: parts[2],
      value: parts.slice(3).join(" "),
      priority: parts[1].toUpperCase() === "MX" ? parts[3] : undefined,
    };
  }
  if (parts.length >= 3) {
    return {
      name: parts[0] === "" ? "@" : parts[0],
      type: parts[1].toUpperCase(),
      value: parts.slice(2).join(" "),
    };
  }
  return null;
}

function dedupeDnsRecords(records: DnsRecord[]): DnsRecord[] {
  const seen = new Set<string>();
  return records.filter((r) => {
    const key = `${r.name}|${r.type}|${r.value}|${r.priority ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function formatDnsRecordArg(record: DnsRecord): {
  param: "add-record" | "add-record-with-ttl";
  value: string;
} {
  const name = record.name === "@" ? "@" : record.name;
  if (record.ttl && /^\d+$/.test(record.ttl)) {
    const base = `${name} ${record.type} ${record.ttl} ${record.value}`;
    const withMx =
      record.type.toUpperCase() === "MX" && record.priority
        ? `${name} ${record.type} ${record.ttl} ${record.priority} ${record.value}`
        : base;
    return { param: "add-record-with-ttl", value: withMx };
  }
  const base = `${name} ${record.type} ${record.value}`;
  const withMx =
    record.type.toUpperCase() === "MX" && record.priority
      ? `${name} ${record.type} ${record.priority} ${record.value}`
      : base;
  return { param: "add-record", value: withMx };
}

export function formatDnsRemoveArg(record: DnsRecord): string {
  const name = record.name === "@" ? "@" : record.name;
  if (record.type.toUpperCase() === "MX" && record.priority) {
    return `${name} ${record.type} ${record.priority} ${record.value}`;
  }
  return `${name} ${record.type} ${record.value}`;
}

/** Parse list-cron / crontab -l output. */
export function parseCronJobs(data: unknown): CronJob[] {
  const rows = normalizeApiRows(data);
  const jobs: CronJob[] = [];
  let id = 0;

  for (const row of rows) {
    const schedule = vmField(row, "schedule") ?? vmField(row, "when");
    const command =
      vmField(row, "command") ?? vmField(row, "commandline") ?? vmField(row, "cmd");
    if (schedule && command) {
      jobs.push({
        id: vmField(row, "id") ?? String(++id),
        schedule,
        command,
        user: vmField(row, "user"),
        active: vmField(row, "active") !== "0",
      });
      continue;
    }

    const line = String(row.line ?? "").trim();
    const parsed = parseCronLine(line);
    if (parsed) {
      jobs.push({ ...parsed, id: String(++id) });
    }
  }

  return jobs;
}

function parseCronLine(line: string): Omit<CronJob, "id"> | null {
  if (
    !line ||
    line.startsWith("#") ||
    line.startsWith("Running ") ||
    line.startsWith("..") ||
    line.startsWith("virtualmin ") ||
    line === "no crontab for"
  ) {
    return null;
  }
  const parts = line.split(/\s+/);
  if (parts.length < 6) return null;
  const schedule = parts.slice(0, 5).join(" ");
  const rest = parts.slice(5);
  const maybeUser =
    rest.length > 1 && !rest[0].includes("/") && !rest[0].includes(".")
      ? rest.shift()
      : undefined;
  const command = rest.join(" ");
  if (!command) return null;
  return {
    schedule,
    command,
    user: maybeUser,
    active: true,
  };
}
