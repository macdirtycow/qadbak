import { execFile } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import {
  assertComposeProject,
  assertComposeYaml,
  assertContainerId,
  assertImageRef,
  assertNetworkName,
  assertVolumeName,
} from "./validate";
import { assertComposePolicyYaml } from "./compose-policy";

const execFileAsync = promisify(execFile);

export class DockerNotAvailableError extends Error {
  constructor(message = "Docker is not installed or not running on this server.") {
    super(message);
    this.name = "DockerNotAvailableError";
  }
}

async function docker(args: string[], timeout = 30_000): Promise<string> {
  try {
    const { stdout } = await execFileAsync("docker", args, {
      timeout,
      maxBuffer: 4 * 1024 * 1024,
    });
    return stdout.trim();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/ENOENT|not found/i.test(msg)) {
      throw new DockerNotAvailableError();
    }
    if (/Cannot connect to the Docker daemon/i.test(msg)) {
      throw new DockerNotAvailableError(
        "Docker daemon is not running. Start docker.service and try again.",
      );
    }
    throw err;
  }
}

export async function dockerAvailable(): Promise<boolean> {
  try {
    await docker(["version", "--format", "{{.Server.Version}}"], 10_000);
    return true;
  } catch {
    return false;
  }
}

export interface DockerContainerRow {
  id: string;
  name: string;
  image: string;
  status: string;
  ports: string;
  created: string;
}

export async function listContainers(): Promise<DockerContainerRow[]> {
  const out = await docker([
    "ps",
    "-a",
    "--format",
    "{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}\t{{.CreatedAt}}",
  ]);
  if (!out) return [];
  return out.split("\n").filter(Boolean).map((line) => {
    const [id, name, image, status, ports, created] = line.split("\t");
    return { id, name, image, status, ports: ports ?? "", created: created ?? "" };
  });
}

export async function containerAction(
  id: string,
  action: "start" | "stop" | "restart" | "remove",
): Promise<void> {
  assertContainerId(id);
  if (action === "remove") {
    await docker(["rm", "-f", id]);
    return;
  }
  await docker([action, id]);
}

export async function containerLogs(id: string, tail = 200): Promise<string> {
  assertContainerId(id);
  const lines = Math.min(Math.max(tail, 10), 2000);
  return docker(["logs", "--tail", String(lines), id], 60_000);
}

export interface DockerImageRow {
  id: string;
  repository: string;
  tag: string;
  size: string;
  created: string;
}

export async function listImages(): Promise<DockerImageRow[]> {
  const out = await docker([
    "images",
    "--format",
    "{{.ID}}\t{{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedSince}}",
  ]);
  if (!out) return [];
  return out.split("\n").filter(Boolean).map((line) => {
    const [id, repository, tag, size, created] = line.split("\t");
    return { id, repository, tag, size, created: created ?? "" };
  });
}

export async function pullImage(ref: string): Promise<void> {
  assertImageRef(ref);
  await docker(["pull", ref], 600_000);
}

export async function removeImage(id: string): Promise<void> {
  assertContainerId(id);
  await docker(["rmi", "-f", id]);
}

export interface DockerVolumeRow {
  name: string;
  driver: string;
  mountpoint: string;
}

export async function listVolumes(): Promise<DockerVolumeRow[]> {
  const out = await docker([
    "volume",
    "ls",
    "--format",
    "{{.Name}}\t{{.Driver}}",
  ]);
  if (!out) return [];
  const rows: DockerVolumeRow[] = [];
  for (const line of out.split("\n").filter(Boolean)) {
    const [name, driver] = line.split("\t");
    rows.push({ name, driver: driver ?? "local", mountpoint: "" });
  }
  return rows;
}

export async function removeVolume(name: string): Promise<void> {
  assertVolumeName(name);
  await docker(["volume", "rm", name]);
}

export interface DockerNetworkRow {
  id: string;
  name: string;
  driver: string;
  scope: string;
}

export async function listNetworks(): Promise<DockerNetworkRow[]> {
  const out = await docker([
    "network",
    "ls",
    "--format",
    "{{.ID}}\t{{.Name}}\t{{.Driver}}\t{{.Scope}}",
  ]);
  if (!out) return [];
  return out.split("\n").filter(Boolean).map((line) => {
    const [id, name, driver, scope] = line.split("\t");
    return { id, name, driver, scope: scope ?? "local" };
  });
}

export async function validateComposeYaml(yaml: string): Promise<string> {
  assertComposeYaml(yaml);
  assertComposePolicyYaml(yaml);
  const dir = await mkdtemp(join(tmpdir(), "qadbak-compose-"));
  const file = join(dir, "docker-compose.yml");
  try {
    await writeFile(file, yaml, "utf8");
    await docker(["compose", "-f", file, "config", "--quiet"], 60_000);
    return "Compose file is valid.";
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function composeUp(
  project: string,
  yaml: string,
): Promise<string> {
  assertComposeProject(project);
  assertComposeYaml(yaml);
  assertComposePolicyYaml(yaml);
  const dir = await mkdtemp(join(tmpdir(), "qadbak-compose-"));
  const file = join(dir, "docker-compose.yml");
  try {
    await writeFile(file, yaml, "utf8");
    await docker(
      ["compose", "-f", file, "-p", project, "up", "-d", "--remove-orphans"],
      600_000,
    );
    return `Compose project "${project}" started.`;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function composeDown(project: string): Promise<string> {
  assertComposeProject(project);
  await docker(["compose", "-p", project, "down", "--remove-orphans"], 120_000);
  return `Compose project "${project}" stopped.`;
}

export async function composePs(project: string): Promise<string> {
  assertComposeProject(project);
  return docker(["compose", "-p", project, "ps"], 30_000);
}
