import fs from "node:fs/promises";
import path from "node:path";
import { isIndependentMode } from "./provisioner/native-stub";

export type NodeRole = "panel" | "provisioner";

export type QadbakNode = {
  id: string;
  name: string;
  roles: NodeRole[];
  agentUrl?: string;
  virtualminUrl?: string;
  isDefault?: boolean;
};

const SERVERS_FILE = path.join(process.cwd(), "data", "servers.json");

function defaultLocalNode(): QadbakNode {
  const host = process.env.QADBAK_PUBLIC_HOST?.trim() || "local";
  const agentPort = process.env.QADBAK_NODE_AGENT_PORT?.trim() || "9100";
  const node: QadbakNode = {
    id: "local",
    name: host,
    roles: ["panel", "provisioner"],
    agentUrl: `http://127.0.0.1:${agentPort}`,
    isDefault: true,
  };
  if (!isIndependentMode()) {
    node.virtualminUrl =
      process.env.VIRTUALMIN_URL?.trim() ||
      "https://127.0.0.1:10000/virtual-server/remote.cgi";
  }
  return node;
}

/** Hide legacy VirtualMin URL when running without VM API. */
export function sanitizeNodeForDisplay(node: QadbakNode): QadbakNode {
  if (!isIndependentMode() || !node.virtualminUrl) return node;
  const { virtualminUrl: _removed, ...rest } = node;
  return rest;
}

export async function loadNodes(): Promise<QadbakNode[]> {
  try {
    const raw = await fs.readFile(SERVERS_FILE, "utf8");
    const parsed = JSON.parse(raw) as QadbakNode[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [sanitizeNodeForDisplay(defaultLocalNode())];
    }
    return parsed.map(sanitizeNodeForDisplay);
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return [sanitizeNodeForDisplay(defaultLocalNode())];
    throw e;
  }
}

export async function saveNodes(nodes: QadbakNode[]): Promise<void> {
  await fs.mkdir(path.dirname(SERVERS_FILE), { recursive: true });
  await fs.writeFile(SERVERS_FILE, `${JSON.stringify(nodes, null, 2)}\n`, "utf8");
}

export function getDefaultNode(nodes: QadbakNode[]): QadbakNode {
  return nodes.find((n) => n.isDefault) ?? nodes[0] ?? defaultLocalNode();
}

export function getNodeById(nodes: QadbakNode[], id: string): QadbakNode | undefined {
  return nodes.find((n) => n.id === id);
}

export function nodeAgentToken(): string {
  return process.env.QADBAK_NODE_AGENT_TOKEN?.trim() ?? "";
}
