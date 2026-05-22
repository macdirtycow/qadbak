import * as vm from "../virtualmin";
import { applyNativeOverrides } from "./apply-native-overrides";
import { createVirtualminProvisioner } from "./virtualmin-adapter";
import {
  findDomainByNameNative,
  listDomainsNative,
} from "./native-domains";
import { listEnabledNativeFeatures } from "./native-features";
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

export function createHybridProvisioner(strictNative = false): Provisioner {
  const backend = vmFallbackEnabled() && !strictNative
    ? createVirtualminProvisioner()
    : null;

  const nativeList = listEnabledNativeFeatures();
  const label =
    strictNative || !vmFallbackEnabled()
      ? `Qadbak native (${nativeList.join(",") || "domains only"})`
      : `Qadbak hybrid (${nativeList.join(",") || "domains"}+VM fallback)`;

  let hybrid: Provisioner = {
    ...(backend ?? vm),
    id: strictNative || !vmFallbackEnabled() ? "native" : "hybrid",
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
          "Webmin/VirtualMin login is disabled (QADBAK_DISABLE_WEBMIN).",
        );
      }
      if (!backend) throw new Error("VirtualMin fallback is not configured.");
      return backend.createVirtualMinLoginLink(...args);
    },
  };

  hybrid = applyNativeOverrides(hybrid);
  return hybrid;
}
