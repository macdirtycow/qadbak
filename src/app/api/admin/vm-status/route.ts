import { requireAdmin } from "@/lib/admin-api";
import { handleApiError, jsonOk } from "@/lib/api";
import { demoSandboxActive, demoVmStatusMock } from "@/lib/demo-sandbox";
import { isIndependentMode } from "@/lib/provisioner/native-stub";
import { getNativeServerStatus } from "@/lib/provisioner/independent-ops";
import { getProvisioner } from "@/lib/provisioner";
import {
  hostingRemoteFetch,
  legacyApiTlsInsecureEnabled,
} from "@/lib/hosting-remote-http";

/** Admin-only: server / provisioner health (native or legacy remote API probe). */
export async function GET() {
  try {
    const session = await requireAdmin();
    if (demoSandboxActive(session.username)) {
      return jsonOk(demoVmStatusMock());
    }

    if (isIndependentMode()) {
      const status = await getNativeServerStatus();
      const domains = await getProvisioner().listDomains(session);
      return jsonOk({
        mode: "native",
        provisioner: "native",
        legacyApiConfigured: false,
        legacyApiUrl: "",
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

    const url = process.env.QADBAK_LEGACY_API_URL ?? "";
    const user = process.env.QADBAK_LEGACY_API_USER ?? "";
    const pass = process.env.QADBAK_LEGACY_API_PASS ?? "";
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
      const res = await hostingRemoteFetch(url, {
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
    const domains = await getProvisioner().listDomains(session);
    return jsonOk({
      mode: "hybrid",
      legacyApiUrl: url,
      tlsInsecure: legacyApiTlsInsecureEnabled(),
      mock: process.env.QADBAK_LEGACY_API_MOCK === "true",
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
