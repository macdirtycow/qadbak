import * as vm from "../virtualmin";
import { createVirtualminProvisioner } from "./virtualmin-adapter";
import {
  findDomainByNameNative,
  listDomainsNative,
} from "./native-domains";
import type { Provisioner } from "./types";

function webminDisabled(): boolean {
  const v = process.env.QADBAK_DISABLE_WEBMIN?.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

function vmFallbackEnabled(): boolean {
  const v = process.env.QADBAK_VIRTUALMIN_FALLBACK?.trim().toLowerCase();
  if (v === "false" || v === "0" || v === "no") return false;
  return Boolean(process.env.VIRTUALMIN_URL?.trim());
}

/**
 * Phase 8 path: domain list + daily UI without VirtualMin API for reads.
 * Other operations still use VirtualMin until native implementations exist.
 */
export function createHybridProvisioner(strictNative = false): Provisioner {
  const backend = vmFallbackEnabled() && !strictNative
    ? createVirtualminProvisioner()
    : null;

  const label = strictNative
    ? "Qadbak native (no VirtualMin)"
    : "Qadbak hybrid (native domains + VirtualMin fallback)";

  const hybrid: Provisioner = {
    ...(backend ?? vm),
    id: strictNative ? "native" : "hybrid",
    label,
    listDomains: listDomainsNative,
    findDomainByName: async (domainName, actor) => {
      const hit = await findDomainByNameNative(domainName, actor);
      if (hit) return hit;
      if (backend) return backend.findDomainByName(domainName, actor);
      return undefined;
    },
    createVirtualMinLoginLink: async (...args) => {
      if (webminDisabled()) {
        throw new Error(
          "Webmin/VirtualMin login is disabled on this server (QADBAK_DISABLE_WEBMIN). Use Qadbak screens only.",
        );
      }
      if (!backend) {
        throw new Error("VirtualMin fallback is not configured.");
      }
      return backend.createVirtualMinLoginLink(...args);
    },
  };

  return hybrid;
}
