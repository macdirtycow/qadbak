/**
 * Docker Compose security policy — block host-escape options in admin-supplied YAML.
 */

const DANGEROUS_PATTERNS = [
  /\bprivileged\s*:\s*true\b/i,
  /\bnetwork_mode\s*:\s*['"]?host['"]?\b/i,
  /\bpid\s*:\s*['"]?host['"]?\b/i,
  /\bipc\s*:\s*['"]?host['"]?\b/i,
  /\/var\/run\/docker\.sock/i,
  /\bcap_add\s*:/i,
  /\bdevices\s*:/i,
];

const FORBIDDEN_BIND_PREFIXES = ["/etc", "/root", "/var/run", "/proc", "/sys", "/dev"];

export function assertComposePolicyYaml(yaml: string): void {
  if (!yaml || typeof yaml !== "string") {
    throw new Error("Invalid compose file content.");
  }
  for (const re of DANGEROUS_PATTERNS) {
    if (re.test(yaml)) {
      throw new Error(
        "Compose file contains disallowed options (privileged, host namespace, docker.sock, cap_add, or devices).",
      );
    }
  }
  for (const line of yaml.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("-")) continue;
    const rest = trimmed.slice(1).trim();
    const colon = rest.indexOf(":");
    if (colon < 0) continue;
    let hostPath = rest.slice(0, colon).trim();
    if (
      (hostPath.startsWith('"') && hostPath.endsWith('"')) ||
      (hostPath.startsWith("'") && hostPath.endsWith("'"))
    ) {
      hostPath = hostPath.slice(1, -1);
    }
    if (hostPath.includes("docker.sock")) {
      throw new Error("Mounting docker.sock is not allowed.");
    }
    if (hostPath === "/") {
      throw new Error("Bind mount of / is not allowed.");
    }
    for (const prefix of FORBIDDEN_BIND_PREFIXES) {
      if (hostPath === prefix || hostPath.startsWith(`${prefix}/`)) {
        throw new Error(`Compose bind mount not allowed: ${hostPath}`);
      }
    }
  }
}
