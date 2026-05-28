import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { emit, fail } from "./provisioning-common.mjs";

const exec = promisify(execFile);

export async function firewallStatus() {
  try {
    const { stdout } = await exec("ufw", ["status", "numbered"], { timeout: 15_000 });
    const active = /Status:\s*active/i.test(stdout);
    const rules = stdout
      .split("\n")
      .filter((l) => /^\[\s*\d+\]/.test(l))
      .map((l) => l.trim());
    emit({ ok: true, tool: "ufw", active, raw: stdout, rules });
  } catch (e) {
    emit({
      ok: false,
      tool: "ufw",
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export async function firewallAllow(port, proto) {
  const p = String(port || "").replace(/\D/g, "");
  if (!p || Number(p) < 1 || Number(p) > 65535) fail("Invalid port");
  const protocol = String(proto || "tcp").toLowerCase() === "udp" ? "udp" : "tcp";
  await exec("ufw", ["allow", `${p}/${protocol}`], { timeout: 30_000 });
  emit({ ok: true, port: p, protocol });
}

export async function firewallDeny(port) {
  const p = String(port || "").replace(/\D/g, "");
  if (!p) fail("Invalid port");
  await exec("ufw", ["delete", "allow", `${p}/tcp`], { timeout: 30_000 }).catch(() => {});
  await exec("ufw", ["deny", `${p}/tcp`], { timeout: 30_000 });
  emit({ ok: true, port: p });
}
