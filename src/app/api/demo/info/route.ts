import { jsonOk } from "@/lib/api";
import {
  demoHost,
  demoPanelEnabled,
  demoReadOnlyEnabled,
  demoShowcaseDomain,
  demoTerminalBlocked,
  demoUsername,
  isDemoHost,
} from "@/lib/demo-mode";

export async function GET(request: Request) {
  const host = request.headers.get("host");
  if (!demoPanelEnabled() || !isDemoHost(host)) {
    return jsonOk({ demo: false });
  }
  const showPassword =
    process.env.QADBAK_DEMO_SHOW_PASSWORD?.trim().toLowerCase() === "true";
  const password = showPassword
    ? process.env.QADBAK_DEMO_PASSWORD?.trim() || "DemoView2026!"
    : undefined;
  return jsonOk({
    demo: true,
    host: demoHost(),
    username: demoUsername(),
    ...(password ? { password } : { passwordHint: "Set QADBAK_DEMO_SHOW_PASSWORD=true on demo host to expose." }),
    readOnly: demoReadOnlyEnabled(),
    terminalDisabled: demoTerminalBlocked(),
    showcaseDomain: demoShowcaseDomain(),
    loginUrl: `https://${demoHost()}/login`,
  });
}
