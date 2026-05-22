import { createHybridProvisioner } from "./hybrid-adapter";
import { createVirtualminProvisioner } from "./virtualmin-adapter";
import type { Provisioner, ProvisionerId } from "./types";

function normalizeProvisionerId(raw: string | undefined): ProvisionerId {
  const id = (raw ?? "virtualmin").trim().toLowerCase();
  if (id === "virtualmin" || id === "mock" || id === "native" || id === "hybrid") {
    return id;
  }
  console.warn(
    `[Qadbak] Unknown QADBAK_PROVISIONER="${raw}" — using virtualmin`,
  );
  return "virtualmin";
}

function createProvisioner(id: ProvisionerId): Provisioner {
  if (id === "hybrid") return createHybridProvisioner(false);
  if (id === "native") return createHybridProvisioner(true);
  // mock: virtualmin.ts handles VIRTUALMIN_MOCK inside virtualMinCall
  return createVirtualminProvisioner();
}

let cached: Provisioner | null = null;

export function getProvisionerId(): ProvisionerId {
  return normalizeProvisionerId(process.env.QADBAK_PROVISIONER);
}

/** Singleton provisioner for server code (API routes, RSC loaders). */
export function getProvisioner(): Provisioner {
  if (!cached) {
    cached = createProvisioner(getProvisionerId());
  }
  return cached;
}

/** Tests or after env change in dev. */
export function resetProvisioner(): void {
  cached = null;
}
