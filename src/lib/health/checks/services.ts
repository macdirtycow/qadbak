/**
 * Service status check — verifies the Qadbak hosting stack daemons are
 * actually running.
 *
 * Each service we depend on is listed with a friendly name + the
 * symptom-in-prose if it's down. We use `systemctl show` to read both
 * LoadState (is the unit even installed?) and ActiveState (is it
 * running?) in a single call so we can distinguish:
 *
 *   - "not installed" → unit file missing. For optional services we
 *     silently skip. For core services we flag a high-severity finding
 *     ("nginx is not installed — your hosting stack is incomplete").
 *   - "inactive" → installed but stopped. Always a finding; severity
 *     depends on whether the service is core or optional.
 *   - "failed" → crashed; always critical-with-suggested-restart.
 *   - "active" → no finding.
 */

import { execFile } from "child_process";
import { promisify } from "util";
import type { HealthCheck, HealthFinding, HealthSeverity } from "../types";

const execFileAsync = promisify(execFile);

interface ServiceSpec {
  unit: string;
  friendly: string;
  symptom: string;
  /**
   * Optional services (named, fail2ban): a missing unit file is not a
   * problem — most VPSes intentionally don't run them. Stopped-after-
   * installation IS a finding (warning).
   */
  optional?: boolean;
}

const SERVICES: ServiceSpec[] = [
  { unit: "nginx", friendly: "nginx (web server)",
    symptom: "Customer websites will return 502/connection refused." },
  { unit: "mariadb", friendly: "MariaDB (database)",
    symptom: "Databases are unreachable; PHP sites that depend on a DB will throw errors." },
  { unit: "postfix", friendly: "Postfix (outbound mail)",
    symptom: "Outgoing mail queues up and never gets delivered." },
  { unit: "dovecot", friendly: "Dovecot (IMAP/POP3)",
    symptom: "Mail clients cannot fetch or send mail through SMTP-AUTH." },
  { unit: "named", friendly: "BIND9 (DNS server)", optional: true,
    symptom: "DNS records for hosted domains stop resolving from outside." },
  { unit: "fail2ban", friendly: "fail2ban (brute-force protection)", optional: true,
    symptom: "SSH and panel-login brute-force attempts are no longer blocked." },
];

type ProbeResult = {
  /** "loaded" / "not-found" / "masked" / "error" */
  loadState: string;
  /** "active" / "inactive" / "failed" / "activating" / "unknown" */
  activeState: string;
};

async function probe(unit: string): Promise<ProbeResult> {
  try {
    const { stdout } = await execFileAsync(
      "systemctl",
      ["show", unit, "--property=LoadState,ActiveState", "--no-pager"],
      { timeout: 3_000 },
    );
    const props: Record<string, string> = {};
    for (const line of stdout.split("\n")) {
      const eq = line.indexOf("=");
      if (eq <= 0) continue;
      props[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
    }
    return {
      loadState: props.LoadState || "unknown",
      activeState: props.ActiveState || "unknown",
    };
  } catch {
    // systemctl unavailable (non-systemd host) — treat as unknown.
    return { loadState: "error", activeState: "unknown" };
  }
}

export const servicesCheck: HealthCheck = {
  id: "services",
  label: "Hosting-stack daemons",
  timeoutMs: 8_000,
  async run(): Promise<HealthFinding[]> {
    const findings: HealthFinding[] = [];
    const now = new Date().toISOString();
    const probes = await Promise.all(
      SERVICES.map(async (s) => ({ spec: s, result: await probe(s.unit) })),
    );
    for (const { spec, result } of probes) {
      const installed = result.loadState === "loaded";
      const active = result.activeState === "active";

      // Healthy: installed AND running → no finding.
      if (installed && active) continue;

      // Not installed at all.
      if (!installed) {
        if (spec.optional) {
          // Optional service that isn't on the box — that's a deliberate
          // choice (many VPSes skip fail2ban or run BIND elsewhere).
          // Don't pollute the dashboard.
          continue;
        }
        findings.push({
          id: `service.${spec.unit}.not-installed`,
          category: "services",
          severity: "critical",
          title: `${spec.friendly} is not installed`,
          explanation: `${spec.symptom} Qadbak expects this daemon to be part of the hosting stack. If you removed it intentionally, mute this finding; otherwise install it.`,
          evidence: `systemctl show ${spec.unit} → LoadState=${result.loadState}, ActiveState=${result.activeState}`,
          suggestion: `Reinstall via apt: sudo apt-get install -y ${spec.unit}`,
          suggestedCommand: `sudo apt-get install -y ${spec.unit} && sudo systemctl enable --now ${spec.unit}`,
          detectedAt: now,
        });
        continue;
      }

      // Installed but not running.
      const severity: HealthSeverity =
        spec.optional ? "warning" : "critical";
      const stateLabel = result.activeState; // "inactive" | "failed" | ...
      findings.push({
        id: `service.${spec.unit}.${stateLabel}`,
        category: "services",
        severity,
        title: `${spec.friendly} is ${stateLabel}`,
        explanation: `${spec.symptom} ${
          spec.optional
            ? `If you intentionally don't use ${spec.unit}, you can stop the unit with 'sudo systemctl disable --now ${spec.unit}' and this finding will go away after the next scan.`
            : `This is a core hosting service — restart it as soon as you can.`
        }`,
        evidence: `systemctl show ${spec.unit} → LoadState=${result.loadState}, ActiveState=${result.activeState}`,
        suggestion: `Inspect the last failure: journalctl -u ${spec.unit} -n 50 --no-pager`,
        suggestedCommand: `sudo systemctl status ${spec.unit} && sudo systemctl restart ${spec.unit}`,
        detectedAt: now,
      });
    }
    return findings;
  },
};
