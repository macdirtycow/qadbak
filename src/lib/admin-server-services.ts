import { isIndependentMode } from "./provisioner/native-stub";
import type { Role } from "./types";
import type { BandwidthRow, ServerService } from "./virtualmin";
import {
  controlNativeServerService,
  listNativeBandwidth,
  listNativeServerServices,
  probeHostServicesSudo,
} from "./host-services-sudo";

const HOST_SERVICES_HINT =
  "Run on the server: sudo bash /opt/qadbak/scripts/configure-host-services-sudo.sh";

export async function listAdminServerServices(_actor: {
  role: Role;
  domains: string[];
}): Promise<{ services: ServerService[]; source: "native" | "virtualmin" }> {
  if (await probeHostServicesSudo()) {
    try {
      const services = await listNativeServerServices();
      return { services, source: "native" };
    } catch (e) {
      if (isIndependentMode()) {
        throw new Error(
          e instanceof Error
            ? `${e.message} — ${HOST_SERVICES_HINT}`
            : HOST_SERVICES_HINT,
        );
      }
    }
  }

  if (isIndependentMode()) {
    throw new Error(`Native service list unavailable. ${HOST_SERVICES_HINT}`);
  }

  const { getProvisioner } = await import("./provisioner");
  const services = await getProvisioner().listServerStatuses(_actor);
  return { services, source: "virtualmin" };
}

export async function listAdminBandwidth(_actor: {
  role: Role;
  domains: string[];
}): Promise<{ rows: BandwidthRow[]; source: "native" | "virtualmin" }> {
  if (await probeHostServicesSudo()) {
    try {
      const rows = await listNativeBandwidth();
      return { rows, source: "native" };
    } catch (e) {
      if (isIndependentMode()) {
        throw new Error(
          e instanceof Error
            ? `${e.message} — ${HOST_SERVICES_HINT}`
            : HOST_SERVICES_HINT,
        );
      }
    }
  }

  if (isIndependentMode()) {
    throw new Error(`Native bandwidth stats unavailable. ${HOST_SERVICES_HINT}`);
  }

  const { getProvisioner } = await import("./provisioner");
  const rows = await getProvisioner().listBandwidth(_actor);
  return { rows, source: "virtualmin" };
}

export async function controlAdminServerService(
  service: string,
  action: "start" | "stop" | "restart",
  actor: { role: Role; domains: string[] },
): Promise<{ source: "native" | "virtualmin" }> {
  if (await probeHostServicesSudo()) {
    try {
      await controlNativeServerService(service, action);
      return { source: "native" };
    } catch (e) {
      if (isIndependentMode()) {
        throw new Error(
          e instanceof Error
            ? `${e.message} — ${HOST_SERVICES_HINT}`
            : HOST_SERVICES_HINT,
        );
      }
      if (action !== "restart") {
        throw new Error(
          e instanceof Error ? e.message : `${action} failed for ${service}`,
        );
      }
    }
  }

  if (isIndependentMode()) {
    throw new Error(`Native service control unavailable. ${HOST_SERVICES_HINT}`);
  }

  if (action !== "restart") {
    throw new Error("Start/stop requires host-services sudo on the server.");
  }
  const { getProvisioner } = await import("./provisioner");
  await getProvisioner().restartServer(service, actor);
  return { source: "virtualmin" };
}
