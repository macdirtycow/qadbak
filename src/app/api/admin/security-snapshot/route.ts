import { requireAdmin } from "@/lib/admin-api";
import { handleApiError, jsonOk } from "@/lib/api";
import { demoSandboxActive, demoSecuritySnapshotMock } from "@/lib/demo-sandbox";
import { runProvisioningHelper } from "@/lib/provisioner/native-exec";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireAdmin();
    if (demoSandboxActive(session.username)) {
      return jsonOk(demoSecuritySnapshotMock());
    }
    const [firewall, fail2ban] = await Promise.all([
      runProvisioningHelper("firewall-status").catch(() => ({
        raw: "",
        rules: [] as string[],
      })),
      runProvisioningHelper("fail2ban-status").catch(() => ({ raw: "" })),
    ]);
    const rules = (firewall.rules as string[] | undefined) ?? [];
    const f2Raw = String(fail2ban.raw ?? "");
    const jails = (f2Raw.match(/Jail list:\s*([^\n]+)/i)?.[1] ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    return jsonOk({
      firewall: {
        ruleCount: rules.length,
        preview: String((firewall as { raw?: string }).raw ?? "").slice(0, 800),
      },
      fail2ban: {
        jailCount: jails.length,
        jails: jails.slice(0, 12),
        preview: f2Raw.slice(0, 1200),
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
