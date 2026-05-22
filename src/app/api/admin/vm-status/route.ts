import { requireAdmin } from "@/lib/admin-api";
import { handleApiError, jsonOk } from "@/lib/api";
import { listDomains } from "@/lib/virtualmin";
import { virtualMinTlsInsecureEnabled } from "@/lib/virtualmin-http";

/** Admin-only: verify VirtualMin API from the running Qadbak process env. */
export async function GET() {
  try {
    await requireAdmin();
    const domains = await listDomains({
      role: "admin",
      domains: [],
    });
    return jsonOk({
      virtualminUrl: process.env.VIRTUALMIN_URL ?? "",
      tlsInsecure: virtualMinTlsInsecureEnabled(),
      mock: process.env.VIRTUALMIN_MOCK === "true",
      domainCount: domains.length,
      domains: domains.map((d) => d.name),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
