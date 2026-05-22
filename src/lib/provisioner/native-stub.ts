import * as vm from "../virtualmin";
import type { Provisioner } from "./types";

const MSG =
  "Not available in independent mode (QADBAK_PROVISIONER=native, fallback off). " +
  "Use hybrid + QADBAK_VIRTUALMIN_FALLBACK=true, or add a native module.";

/** VM API surface with every method rejecting — used when VirtualMin fallback is disabled. */
export function createUnimplementedProvisioner(): typeof vm {
  const stub: Record<string, unknown> = {};
  for (const key of Object.keys(vm)) {
    const fn = (vm as Record<string, unknown>)[key];
    if (typeof fn !== "function") continue;
    stub[key] = (..._args: unknown[]) => {
      throw new Error(`${String(key)}: ${MSG}`);
    };
  }
  return stub as typeof vm;
}

export function isIndependentMode(): boolean {
  const prov = process.env.QADBAK_PROVISIONER?.trim().toLowerCase();
  const fb = process.env.QADBAK_VIRTUALMIN_FALLBACK?.trim().toLowerCase();
  const fallbackOff = fb === "false" || fb === "0" || fb === "no";
  return prov === "native" || (prov === "hybrid" && fallbackOff);
}
