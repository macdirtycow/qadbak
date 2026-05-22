import type { Role } from "../types";
import type * as VirtualminModule from "../virtualmin";

/** Session shape passed into provisioner calls (RBAC). */
export type ProvisionerActor = {
  role: Role;
  domains: string[];
};

/** Which backend implements hosting operations. */
export type ProvisionerId = "virtualmin" | "mock" | "native" | "hybrid";

export type ProvisionerCore = {
  readonly id: ProvisionerId;
  readonly label: string;
};

/**
 * Full hosting API surface. Phase 2: VirtualMin adapter; later native/hestia.
 * Implementation is `typeof virtualmin` spread into the adapter instance.
 */
export type Provisioner = ProvisionerCore & typeof VirtualminModule;
