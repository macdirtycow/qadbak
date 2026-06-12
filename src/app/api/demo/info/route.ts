import { jsonOk } from "@/lib/api";
import {
  demoHost,
  demoPanelEnabled,
  demoReadOnlyEnabled,
  demoShowcaseDomain,
  demoUsername,
  isDemoHost,
} from "@/lib/demo-mode";

export async function GET(request: Request) {
  const host = request.headers.get("host");
  if (!demoPanelEnabled() || !isDemoHost(host)) {
    return jsonOk({ demo: false });
  }
  const password = process.env.QADBAK_DEMO_PASSWORD?.trim() || "DemoView2026!";
  return jsonOk({
    demo: true,
    host: demoHost(),
    username: demoUsername(),
    password,
    readOnly: demoReadOnlyEnabled(),
    showcaseDomain: demoShowcaseDomain(),
    loginUrl: `https://${demoHost()}/login`,
  });
}
