const CONTAINER_ID = /^[a-f0-9]{12,64}$/i;
const VOLUME_NAME = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,254}$/;
const NETWORK_NAME = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,254}$/;
const COMPOSE_PROJECT = /^[a-z][a-z0-9_-]{0,62}$/;
/** OCI image reference (simplified, no shell metacharacters). */
const IMAGE_REF =
  /^[a-z0-9][a-z0-9._/-]{0,254}(:[a-zA-Z0-9._-]{1,128})?(@sha256:[a-f0-9]{64})?$/;

export const MAX_COMPOSE_YAML_BYTES = 256 * 1024;

export function assertContainerId(id: string): void {
  if (!CONTAINER_ID.test(id)) {
    throw new Error("Invalid container id.");
  }
}

export function assertImageRef(ref: string): void {
  if (!IMAGE_REF.test(ref)) {
    throw new Error("Invalid image reference.");
  }
}

export function assertVolumeName(name: string): void {
  if (!VOLUME_NAME.test(name)) {
    throw new Error("Invalid volume name.");
  }
}

export function assertNetworkName(name: string): void {
  if (!NETWORK_NAME.test(name)) {
    throw new Error("Invalid network name.");
  }
}

export function assertComposeProject(name: string): void {
  if (!COMPOSE_PROJECT.test(name)) {
    throw new Error("Invalid compose project name.");
  }
}

export function assertComposeYaml(yaml: string): void {
  if (yaml.includes("\0")) {
    throw new Error("Invalid compose file content.");
  }
  const bytes = Buffer.byteLength(yaml, "utf8");
  if (bytes === 0) {
    throw new Error("Compose file is empty.");
  }
  if (bytes > MAX_COMPOSE_YAML_BYTES) {
    throw new Error("Compose file is too large.");
  }
  if (!/^\s*services\s*:/m.test(yaml) && !/^\s*version\s*:/m.test(yaml)) {
    throw new Error("Compose file must define services.");
  }
}

export function assertDockerAction(
  action: string,
): asserts action is "start" | "stop" | "restart" | "remove" {
  if (!["start", "stop", "restart", "remove"].includes(action)) {
    throw new Error("Invalid container action.");
  }
}
