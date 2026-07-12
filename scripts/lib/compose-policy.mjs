/**
 * Docker Compose security policy — block host-escape options in user-supplied YAML.
 */

const DANGEROUS_PATTERNS = [
  /\bprivileged\s*:\s*true\b/i,
  /\bnetwork_mode\s*:\s*['"]?host['"]?\b/i,
  /\bpid\s*:\s*['"]?host['"]?\b/i,
  /\bipc\s*:\s*['"]?host['"]?\b/i,
  /\/var\/run\/docker\.sock/i,
  /\bcap_add\s*:/i,
  /\bdevices\s*:/i,
  /\b--privileged\b/,
];

const FORBIDDEN_BIND_PREFIXES = [
  "/",
  "/etc",
  "/root",
  "/var/run",
  "/proc",
  "/sys",
  "/dev",
];

/**
 * Scan raw compose YAML for dangerous directives.
 * @param {string} yaml
 */
export function assertComposePolicyYaml(yaml) {
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
  const bindRe = /-\s*['"]?([^'":\s]+)\s*:\s*/g;
  let m;
  while ((m = bindRe.exec(yaml)) !== null) {
    const hostPath = m[1].replace(/^['"]|['"]$/g, "");
    for (const prefix of FORBIDDEN_BIND_PREFIXES) {
      if (hostPath === prefix || hostPath.startsWith(`${prefix}/`)) {
        if (hostPath === "/" || !hostPath.startsWith("/home/")) {
          throw new Error(`Compose bind mount not allowed: ${hostPath}`);
        }
      }
    }
    if (hostPath === "/var/run/docker.sock" || hostPath.endsWith("docker.sock")) {
      throw new Error("Mounting docker.sock is not allowed.");
    }
  }
}

/**
 * @param {object} config — parsed compose config (services map)
 */
export function assertComposePolicyConfig(config) {
  if (!config || typeof config !== "object") return;
  const services = config.services ?? config;
  if (!services || typeof services !== "object") return;
  for (const [name, svc] of Object.entries(services)) {
    if (!svc || typeof svc !== "object") continue;
    if (svc.privileged === true) {
      throw new Error(`Service "${name}": privileged containers are not allowed.`);
    }
    const nm = svc.network_mode ?? svc.networkMode;
    if (nm === "host") {
      throw new Error(`Service "${name}": network_mode host is not allowed.`);
    }
    const pid = svc.pid;
    if (pid === "host") {
      throw new Error(`Service "${name}": pid host is not allowed.`);
    }
    if (svc.cap_add || svc.capAdd) {
      throw new Error(`Service "${name}": cap_add is not allowed.`);
    }
    if (svc.devices) {
      throw new Error(`Service "${name}": device mounts are not allowed.`);
    }
    const vols = svc.volumes ?? [];
    for (const v of vols) {
      const src = typeof v === "string" ? v.split(":")[0] : v?.source ?? v?.bind?.source;
      if (!src) continue;
      if (src.includes("docker.sock")) {
        throw new Error(`Service "${name}": docker.sock mount is not allowed.`);
      }
      if (
        src === "/" ||
        src.startsWith("/etc/") ||
        src.startsWith("/root/") ||
        src.startsWith("/var/run/")
      ) {
        throw new Error(`Service "${name}": bind mount "${src}" is not allowed.`);
      }
    }
  }
}
