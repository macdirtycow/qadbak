import { auditLog } from "@/lib/audit";
import { requireAdmin } from "@/lib/admin-api";
import { handleApiError, jsonError, jsonOk } from "@/lib/api";
import {
  ensurePanelVhost,
  getPanelClientStatus,
  upsertPanelClient,
} from "@/lib/panel-client-admin";

type Props = { params: Promise<{ domain: string }> };

export async function GET(_request: Request, { params }: Props) {
  try {
    await requireAdmin();
    const { domain } = await params;
    const status = await getPanelClientStatus(decodeURIComponent(domain));
    return jsonOk(status);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: Request, { params }: Props) {
  try {
    const session = await requireAdmin();
    const { domain: encoded } = await params;
    const domainName = decodeURIComponent(encoded).trim().toLowerCase();
    const body = (await request.json()) as {
      action?: string;
      password?: string;
      username?: string;
    };

    if (body.action === "apply-vhost") {
      const output = await ensurePanelVhost(domainName);
      await auditLog(session.username, "panel-vhost-apply", domainName);
      const status = await getPanelClientStatus(domainName);
      return jsonOk({ ok: true, output, ...status });
    }

    if (body.action === "upsert-client") {
      if (!body.password) {
        return jsonError("Password is required (min. 8 characters).");
      }
      const { username, created } = await upsertPanelClient({
        domain: domainName,
        password: body.password,
        username: body.username,
      });
      await auditLog(
        session.username,
        created ? "panel-client-create" : "panel-client-reset",
        domainName,
        username,
      );
      const status = await getPanelClientStatus(domainName);
      return jsonOk({
        ok: true,
        username,
        created,
        message: created
          ? "Client account created."
          : "Client password updated.",
        ...status,
      });
    }

    return jsonError('Invalid action. Use "upsert-client" or "apply-vhost".');
  } catch (err) {
    return handleApiError(err);
  }
}
