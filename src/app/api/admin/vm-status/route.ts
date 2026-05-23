import { requireAdmin } from "@/lib/admin-api";
import { handleApiError, jsonOk } from "@/lib/api";
import { isIndependentMode } from "@/lib/provisioner/native-stub";
import { getNativeServerStatus } from "@/lib/provisioner/independent-ops";
import { getProvisioner } from "@/lib/provisioner";
import {
  virtualMinFetch,
  virtualMinTlsInsecureEnabled,
} from "@/lib/virtualmin-http";

/** Admin-only: server / provisioner health (native or legacy VirtualMin probe). */
export async function GET() {
  try {
    await requireAdmin();

    if (isIndependentMode()) {
      const status = await getNativeServerStatus();
      const domains = await getProvisioner().listDomains({
        role: "admin",
        domains: [],
      });
      return jsonOk({
        mode: "native",
        provisioner: "native",
        virtualminConfigured: false,
        virtualminUrl: "",
        tlsInsecure: false,
        mock: false,
        probeStatus: 0,
        probeBytes: 0,
        probePreview: "Native provisioner (no remote hosting API)",
        domainCount: domains.length,
        domains: domains.map((d) => d.name),
        services: status.services,
        nginxTest: status.nginxTest,
      });
    }

    const url = process.env.VIRTUALMIN_URL ?? "";
    const user = process.env.VIRTUALMIN_USER ?? "";
    const pass = process.env.VIRTUALMIN_PASS ?? "";
    let probeStatus = 0;
    let probeBytes = 0;
    let probePreview = "";
    if (url && user && pass) {
      const body = new URLSearchParams({
        program: "list-domains",
        json: "1",
        multiline: "",
      });
      const auth = Buffer.from(`${user}:${pass}`).toString("base64");
      const res = await virtualMinFetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });
      probeStatus = res.status;
      const text = await res.text();
      probeBytes = text.length;
      probePreview = text.slice(0, 120).replace(/\s+/g, " ");
    }
    const domains = await getProvisioner().listDomains({
      role: "admin",
      domains: [],
    });
    return jsonOk({
      mode: "hybrid",
      virtualminUrl: url,
      tlsInsecure: virtualMinTlsInsecureEnabled(),
      mock: process.env.VIRTUALMIN_MOCK === "true",
      probeStatus,
      probeBytes,
      probePreview,
      domainCount: domains.length,
      domains: domains.map((d) => d.name),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
