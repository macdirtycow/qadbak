import { requireAdmin } from "@/lib/admin-api";
import { handleApiError, jsonOk } from "@/lib/api";
import { demoFail2banMock, demoSandboxActive } from "@/lib/demo-sandbox";
import { runProvisioningHelper } from "@/lib/provisioner/native-exec";

export async function GET() {
  try {
    const session = await requireAdmin();
    if (demoSandboxActive(session.username)) {
      return jsonOk(demoFail2banMock());
    }
    const r = await runProvisioningHelper("fail2ban-status");
    return jsonOk(r);
  } catch (err) {
    return handleApiError(err);
  }
}
